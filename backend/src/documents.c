#define _POSIX_C_SOURCE 200809L
#include "http.h"
#include <errno.h>
#include <fcntl.h>
#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>
#include <sys/stat.h>
#include <unistd.h>

static int positive_id(const char *value, sqlite3_int64 *id)
{
    if (!value || !*value) return 0;
    for (const char *p = value; *p; ++p) if (*p < '0' || *p > '9') return 0;
    errno = 0;
    char *end;
    long long n = strtoll(value, &end, 10);
    if (errno || *end || n <= 0) return 0;
    *id = (sqlite3_int64)n;
    return 1;
}

static http_result file_response(sqlite3 *db, struct MHD_Connection *connection, sqlite3_int64 id)
{
    sqlite3_stmt *stmt = NULL;
    if (sqlite3_prepare_v2(db, "SELECT file_path FROM documents WHERE id=?", -1, &stmt, NULL) != SQLITE_OK)
        return reply(connection, 500, "{\"error\":\"database_error\"}");
    sqlite3_bind_int64(stmt, 1, id);
    int rc = sqlite3_step(stmt), fd = -1;
    if (rc == SQLITE_ROW) {
        const unsigned char *path = sqlite3_column_text(stmt, 0);
        if (path && strncmp((const char *)path, "data/files/upload-", 18) == 0
            && !strchr((const char *)path + 18, '/')) fd = open((const char *)path, O_RDONLY | O_NOFOLLOW);
    }
    sqlite3_finalize(stmt);
    if (rc == SQLITE_DONE) return reply(connection, 404, "{\"error\":\"not_found\"}");
    if (rc != SQLITE_ROW) return reply(connection, 500, "{\"error\":\"database_error\"}");
    if (fd < 0) return reply(connection, 500, "{\"error\":\"file_unavailable\"}");
    struct stat st;
    if (fstat(fd, &st) || !S_ISREG(st.st_mode) || st.st_size < 0) {
        close(fd); return reply(connection, 500, "{\"error\":\"file_unavailable\"}");
    }
    struct MHD_Response *response = MHD_create_response_from_fd((size_t)st.st_size, fd);
    if (!response) { close(fd); return MHD_NO; }
    char disposition[96];
    snprintf(disposition, sizeof(disposition), "attachment; filename=\"document-%lld.pdf\"", (long long)id);
    MHD_add_response_header(response, "Content-Type", "application/pdf");
    MHD_add_response_header(response, "Content-Disposition", disposition);
    MHD_add_response_header(response, "X-Content-Type-Options", "nosniff");
    http_result result = MHD_queue_response(connection, 200, response);
    MHD_destroy_response(response);
    return result;
}

static int append_document(struct json_buffer *buffer, sqlite3_stmt *stmt)
{
    char numbers[160];
    sqlite3_int64 id = sqlite3_column_int64(stmt, 0);
    snprintf(numbers, sizeof(numbers), "{\"id\":%lld,\"title\":", (long long)id);
    int ok = append(buffer, numbers)
        && append_json_string(buffer, sqlite3_column_text(stmt, 1))
        && append(buffer, ",\"authors\":")
        && append_json_string(buffer, sqlite3_column_text(stmt, 2))
        && append(buffer, ",\"created_at\":")
        && append_json_string(buffer, sqlite3_column_text(stmt, 4));
    snprintf(numbers, sizeof(numbers), ",\"file_size\":%lld,\"file_url\":\"/api/documents/%lld/file\",\"subject_ids\":[",
             (long long)sqlite3_column_int64(stmt, 3), (long long)id);
    return ok && append(buffer, numbers);
}

http_result documents_get(sqlite3 *db, struct MHD_Connection *connection, const char *url)
{
    sqlite3_int64 id = 0, subject = 0, offset = 0;
    int listing = strcmp(url, "/api/documents") == 0;
    if (!listing) {
        const char *suffix = url + 15;
        const char *slash = strchr(suffix, '/');
        char number[32];
        size_t length = slash ? (size_t)(slash - suffix) : strlen(suffix);
        if (!length || length >= sizeof(number)) return reply(connection, 404, "{\"error\":\"not_found\"}");
        memcpy(number, suffix, length); number[length] = '\0';
        if (!positive_id(number, &id)) return reply(connection, 404, "{\"error\":\"not_found\"}");
        if (slash) {
            if (strcmp(slash, "/file") != 0) return reply(connection, 404, "{\"error\":\"not_found\"}");
            return file_response(db, connection, id);
        }
    } else {
        const char *filter = MHD_lookup_connection_value(connection, MHD_GET_ARGUMENT_KIND, "subject_id");
        const char *start = MHD_lookup_connection_value(connection, MHD_GET_ARGUMENT_KIND, "offset");
        if ((filter && !positive_id(filter, &subject))
            || (start && strcmp(start, "0") && !positive_id(start, &offset)))
            return reply(connection, 400, "{\"error\":\"invalid_query\"}");
    }
    sqlite3_stmt *stmt = NULL, *links = NULL;
    const char *sql = listing
        ? "SELECT id,title,authors,file_size,created_at FROM documents WHERE (?=0 OR EXISTS "
          "(SELECT 1 FROM document_subjects WHERE document_id=documents.id AND subject_id=?)) "
          "ORDER BY id DESC LIMIT 20 OFFSET ?"
        : "SELECT id,title,authors,file_size,created_at FROM documents WHERE id=?";
    if (sqlite3_prepare_v2(db, sql, -1, &stmt, NULL) != SQLITE_OK)
        return reply(connection, 500, "{\"error\":\"database_error\"}");
    sqlite3_bind_int64(stmt, 1, listing ? subject : id);
    if (listing) { sqlite3_bind_int64(stmt, 2, subject); sqlite3_bind_int64(stmt, 3, offset); }
    int ok = sqlite3_prepare_v2(db,
        "SELECT subject_id FROM document_subjects WHERE document_id=? ORDER BY subject_id",
        -1, &links, NULL) == SQLITE_OK;
    struct json_buffer buffer = { "", 0 };
    if (listing) ok = ok && append(&buffer, "{\"documents\":[");
    int rc = SQLITE_DONE, rows = 0;
    while (ok && (rc = sqlite3_step(stmt)) == SQLITE_ROW) {
        if (rows && listing) ok = append(&buffer, ",");
        ok = ok && append_document(&buffer, stmt);
        sqlite3_bind_int64(links, 1, sqlite3_column_int64(stmt, 0));
        int link_rc = SQLITE_DONE, count = 0;
        while (ok && (link_rc = sqlite3_step(links)) == SQLITE_ROW) {
            char number[32];
            snprintf(number, sizeof(number), "%s%lld", count++ ? "," : "",
                     (long long)sqlite3_column_int64(links, 0));
            ok = append(&buffer, number);
        }
        ok = ok && link_rc == SQLITE_DONE && append(&buffer, "]}");
        sqlite3_reset(links);
        ++rows;
    }
    sqlite3_finalize(links); sqlite3_finalize(stmt);
    if (!ok || rc != SQLITE_DONE) return reply(connection, 500, "{\"error\":\"database_error\"}");
    if (!listing && !rows) return reply(connection, 404, "{\"error\":\"not_found\"}");
    if (listing) {
        char tail[96];
        snprintf(tail, sizeof(tail), "],\"limit\":20,\"offset\":%lld}", (long long)offset);
        if (!append(&buffer, tail)) return reply(connection, 500, "{\"error\":\"database_error\"}");
    }
    return reply(connection, 200, buffer.data);
}
