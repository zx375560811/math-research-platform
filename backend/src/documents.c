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

#define MAX_PDF_BYTES (20U * 1024U * 1024U)
struct upload {
    int fd, saved;
    unsigned int status;
    const char *error;
    size_t size;
    sqlite3_int64 subject;
    char title[501], authors[501], path[64];
};

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

/* Accept bounded UTF-8 metadata, reject control characters and invalid encodings. */
static int metadata_ok(const char *text, int required)
{
    if (!text || strlen(text) > 500 || (required && !*text)) return 0;
    const unsigned char *p = (const unsigned char *)text;
    int visible = 0;
    while (*p) {
        unsigned int value;
        size_t count;
        if (*p < 0x80) {
            if (*p < 0x20 || *p == 0x7f) return 0;
            if (*p != ' ') visible = 1;
            ++p; continue;
        }
        if (*p >= 0xc2 && *p <= 0xdf) { count = 2; value = *p & 0x1f; }
        else if (*p >= 0xe0 && *p <= 0xef) { count = 3; value = *p & 0x0f; }
        else if (*p >= 0xf0 && *p <= 0xf4) { count = 4; value = *p & 7; }
        else return 0;
        for (size_t i = 1; i < count; ++i) {
            if ((p[i] & 0xc0) != 0x80) return 0;
            value = (value << 6) | (p[i] & 0x3f);
        }
        if ((count == 3 && value < 0x800) || (count == 4 && value < 0x10000)
            || (value >= 0xd800 && value <= 0xdfff) || value > 0x10ffff) return 0;
        visible = 1; p += count;
    }
    return !required || visible;
}

static void fail_upload(struct upload *u, unsigned int status, const char *error)
{ u->status = status; u->error = error; }

void *documents_begin(sqlite3 *db, struct MHD_Connection *connection)
{
    struct upload *u = calloc(1, sizeof(*u));
    if (!u) return NULL;
    u->fd = -1;
    const char *type = MHD_lookup_connection_value(connection, MHD_HEADER_KIND, "Content-Type");
    const char *title = MHD_lookup_connection_value(connection, MHD_GET_ARGUMENT_KIND, "title");
    const char *authors = MHD_lookup_connection_value(connection, MHD_GET_ARGUMENT_KIND, "authors");
    const char *subject = MHD_lookup_connection_value(connection, MHD_GET_ARGUMENT_KIND, "subject_id");
    if (!type || strcasecmp(type, "application/pdf") != 0) {
        fail_upload(u, 415, "use_application_pdf"); return u;
    }
    if (!authors) authors = "";
    if (!metadata_ok(title, 1) || !metadata_ok(authors, 0) || !positive_id(subject, &u->subject)) {
        fail_upload(u, 400, "invalid_metadata"); return u;
    }
    const char *length = MHD_lookup_connection_value(connection, MHD_HEADER_KIND, "Content-Length");
    if (length) {
        sqlite3_int64 n;
        if (!positive_id(length, &n)) { fail_upload(u, 400, "empty_or_invalid_length"); return u; }
        if (n > MAX_PDF_BYTES) { fail_upload(u, 413, "pdf_too_large"); return u; }
    }
    sqlite3_stmt *stmt = NULL;
    if (sqlite3_prepare_v2(db, "SELECT id FROM subjects WHERE id=?", -1, &stmt, NULL) != SQLITE_OK) {
        fail_upload(u, 500, "database_error"); return u;
    }
    sqlite3_bind_int64(stmt, 1, u->subject);
    int rc = sqlite3_step(stmt);
    sqlite3_finalize(stmt);
    if (rc != SQLITE_ROW) {
        fail_upload(u, rc == SQLITE_DONE ? 400 : 500,
                    rc == SQLITE_DONE ? "unknown_subject" : "database_error"); return u;
    }
    strcpy(u->title, title); strcpy(u->authors, authors);
    strcpy(u->path, "data/files/upload-XXXXXX");
    u->fd = mkstemp(u->path);
    if (u->fd < 0) { u->path[0] = '\0'; fail_upload(u, 500, "file_storage_error"); }
    return u;
}

void documents_cleanup(void *context)
{
    struct upload *u = context;
    if (u->fd >= 0) close(u->fd);
    if (!u->saved && *u->path) unlink(u->path);
    free(u);
}

http_result documents_upload(sqlite3 *db, struct MHD_Connection *connection,
                             void *context, const char *data, size_t *length)
{
    struct upload *u = context;
    if (*length) {
        if (!u->error && *length > MAX_PDF_BYTES - u->size)
            fail_upload(u, 413, "pdf_too_large");
        if (!u->error) {
            size_t written = 0;
            while (written < *length) {
                ssize_t n = write(u->fd, data + written, *length - written);
                if (n < 0 && errno == EINTR) continue;
                if (n <= 0) { fail_upload(u, 500, "file_storage_error"); break; }
                written += (size_t)n;
            }
            u->size += written;
        }
        *length = 0;
        return MHD_YES;
    }
    if (u->error) {
        char message[128];
        snprintf(message, sizeof(message), "{\"error\":\"%s\"}", u->error);
        return reply(connection, u->status, message);
    }
    char magic[5];
    if (u->size < 5 || pread(u->fd, magic, 5, 0) != 5 || memcmp(magic, "%PDF-", 5) != 0)
        return reply(connection, 400, "{\"error\":\"invalid_pdf_header\"}");
    if (fsync(u->fd) != 0) return reply(connection, 500, "{\"error\":\"file_storage_error\"}");
    if (close(u->fd) != 0) { u->fd = -1; return reply(connection, 500, "{\"error\":\"file_storage_error\"}"); }
    u->fd = -1;
    if (sqlite3_exec(db, "BEGIN IMMEDIATE", NULL, NULL, NULL) != SQLITE_OK)
        return reply(connection, 503, "{\"error\":\"database_busy\"}");
    sqlite3_stmt *stmt = NULL;
    int ok = sqlite3_prepare_v2(db,
        "INSERT INTO documents(title,authors,file_path,file_size) VALUES(?,?,?,?)",
        -1, &stmt, NULL) == SQLITE_OK;
    if (ok) {
        ok = sqlite3_bind_text(stmt, 1, u->title, -1, SQLITE_TRANSIENT) == SQLITE_OK
            && sqlite3_bind_text(stmt, 2, u->authors, -1, SQLITE_TRANSIENT) == SQLITE_OK
            && sqlite3_bind_text(stmt, 3, u->path, -1, SQLITE_TRANSIENT) == SQLITE_OK
            && sqlite3_bind_int64(stmt, 4, (sqlite3_int64)u->size) == SQLITE_OK
            && sqlite3_step(stmt) == SQLITE_DONE;
    }
    sqlite3_finalize(stmt); stmt = NULL;
    sqlite3_int64 id = sqlite3_last_insert_rowid(db);
    if (ok) ok = sqlite3_prepare_v2(db,
        "INSERT INTO document_subjects(document_id,subject_id) VALUES(?,?)",
        -1, &stmt, NULL) == SQLITE_OK;
    if (ok) ok = sqlite3_bind_int64(stmt, 1, id) == SQLITE_OK
        && sqlite3_bind_int64(stmt, 2, u->subject) == SQLITE_OK
        && sqlite3_step(stmt) == SQLITE_DONE;
    sqlite3_finalize(stmt);
    if (!ok || sqlite3_exec(db, "COMMIT", NULL, NULL, NULL) != SQLITE_OK) {
        sqlite3_exec(db, "ROLLBACK", NULL, NULL, NULL);
        return reply(connection, 500, "{\"error\":\"database_error\"}");
    }
    u->saved = 1;
    char message[192];
    snprintf(message, sizeof(message), "{\"id\":%lld,\"file_url\":\"/api/documents/%lld/file\"}",
             (long long)id, (long long)id);
    return reply(connection, 201, message);
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
