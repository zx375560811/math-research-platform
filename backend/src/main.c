#define _POSIX_C_SOURCE 200809L
#include <arpa/inet.h>
#include <errno.h>
#include <microhttpd.h>
#include <signal.h>
#include <sqlite3.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <time.h>
#include "schema.h"
#include "http.h"

static volatile sig_atomic_t stopping = 0;
static void stop_server(int sig) { (void)sig; stopping = 1; }

http_result reply(struct MHD_Connection *connection,
                         unsigned int status, const char *json)
{
    struct MHD_Response *response = MHD_create_response_from_buffer(
        strlen(json), (void *)json, MHD_RESPMEM_MUST_COPY);
    if (!response) return MHD_NO;
    MHD_add_response_header(response, "Content-Type", "application/json; charset=utf-8");
    MHD_add_response_header(response, "Cache-Control", "no-store");
    http_result result = MHD_queue_response(connection, status, response);
    MHD_destroy_response(response);
    return result;
}

int append(struct json_buffer *buffer, const char *value)
{
    size_t n = strlen(value);
    if (n >= sizeof(buffer->data) - buffer->length) return 0;
    memcpy(buffer->data + buffer->length, value, n + 1);
    buffer->length += n;
    return 1;
}

int append_json_string(struct json_buffer *buffer, const unsigned char *value)
{
    if (!value || !append(buffer, "\"")) return 0;
    for (; *value; ++value) {
        char escaped[7];
        if (*value == '"' || *value == '\\') {
            escaped[0] = '\\'; escaped[1] = (char)*value; escaped[2] = '\0';
        } else if (*value < 0x20) {
            snprintf(escaped, sizeof(escaped), "\\u%04x", (unsigned)*value);
        } else {
            escaped[0] = (char)*value; escaped[1] = '\0';
        }
        if (!append(buffer, escaped)) return 0;
    }
    return append(buffer, "\"");
}

static http_result subjects(sqlite3 *db, struct MHD_Connection *connection)
{
    sqlite3_stmt *statement = NULL;
    struct json_buffer buffer = { "", 0 };
    if (sqlite3_prepare_v2(db, "SELECT id,slug,name FROM subjects ORDER BY id",
                          -1, &statement, NULL) != SQLITE_OK)
        return reply(connection, 500, "{\"error\":\"database_error\"}");
    int ok = append(&buffer, "{\"subjects\":[");
    int step = SQLITE_DONE, first = 1;
    while (ok && (step = sqlite3_step(statement)) == SQLITE_ROW) {
        char prefix[80];
        snprintf(prefix, sizeof(prefix), "%s{\"id\":%lld,\"slug\":",
                 first ? "" : ",", (long long)sqlite3_column_int64(statement, 0));
        ok = append(&buffer, prefix)
            && append_json_string(&buffer, sqlite3_column_text(statement, 1))
            && append(&buffer, ",\"name\":")
            && append_json_string(&buffer, sqlite3_column_text(statement, 2))
            && append(&buffer, "}");
        first = 0;
    }
    sqlite3_finalize(statement);
    if (!ok || step != SQLITE_DONE || !append(&buffer, "]}"))
        return reply(connection, 500, "{\"error\":\"database_error\"}");
    return reply(connection, 200, buffer.data);
}

static int read_only_request;
static void request_completed(void *cls, struct MHD_Connection *connection,
    void **context, enum MHD_RequestTerminationCode reason)
{
    (void)cls; (void)connection; (void)reason;
    *context = NULL;
}

static http_result handle_request(void *cls, struct MHD_Connection *connection,
    const char *url, const char *method, const char *version,
    const char *upload_data, size_t *upload_size, void **request_context)
{
    (void)version;
    if (!*request_context) {
        *request_context = &read_only_request;
        return MHD_YES;
    }
    if (*upload_size != 0) { *upload_size = 0; return MHD_YES; }
    if (strcmp(method, "GET") != 0)
        return reply(connection, 405, "{\"error\":\"method_not_allowed\"}");
    if (!strcmp(url, "/") || !strcmp(url, "/index.html") || !strcmp(url, "/app.js") || !strcmp(url, "/style.css") || !strcmp(url, "/icons.js") || !strcmp(url, "/vendor/morphicons/dom.js") || !strcmp(url, "/vendor/morphicons/spring-CFHloqPP.js") || !strcmp(url, "/vendor/morphicons/normalize-CYnN3Npw.js"))
        return web_get(connection, url);
    if (strcmp(url, "/api/health") == 0) {
        if (sqlite3_exec(cls, "SELECT 1 FROM subjects LIMIT 1", NULL, NULL, NULL) != SQLITE_OK)
            return reply(connection, 503, "{\"status\":\"unhealthy\"}");
        return reply(connection, 200, "{\"status\":\"ok\",\"database\":\"ok\"}");
    }
    if (strcmp(url, "/api/subjects") == 0) return subjects(cls, connection);
    if (strcmp(url, "/api/documents") == 0 || strncmp(url, "/api/documents/", 15) == 0)
        return documents_get(cls, connection, url);
    if (strcmp(url, "/api/ai/status") == 0)
        return reply(connection, 200, "{\"enabled\":false,\"status\":\"not_configured\"}");
    return reply(connection, 404, "{\"error\":\"not_found\"}");
}

int main(void)
{
    const char *port_env = getenv("MATH_PORT");
    const char *db_path = getenv("MATH_DB_PATH");
    if (!db_path || !*db_path) db_path = "data/math.db";
    char *end = NULL;
    errno = 0;
    long port = port_env ? strtol(port_env, &end, 10) : 8080;
    if (errno || port < 1 || port > 65535 || (port_env && (!*port_env || *end))) {
        fprintf(stderr, "Invalid MATH_PORT\n"); return EXIT_FAILURE;
    }
    if (mkdir("data", 0700) != 0 && errno != EEXIST) {
        perror("mkdir data"); return EXIT_FAILURE;
    }
    if (mkdir("data/files", 0700) != 0 && errno != EEXIST) {
        perror("mkdir data/files"); return EXIT_FAILURE;
    }
    sqlite3 *db = NULL;
    if (sqlite3_open(db_path, &db) != SQLITE_OK) {
        fprintf(stderr, "Cannot open database: %s\n", db ? sqlite3_errmsg(db) : "out of memory");
        sqlite3_close(db); return EXIT_FAILURE;
    }
    sqlite3_busy_timeout(db, 3000);
    char *error = NULL;
    if (sqlite3_exec(db, schema_sql, NULL, NULL, &error) != SQLITE_OK) {
        fprintf(stderr, "Database initialization failed: %s\n", error);
        sqlite3_free(error); sqlite3_close(db); return EXIT_FAILURE;
    }
    struct sigaction action;
    memset(&action, 0, sizeof(action));
    action.sa_handler = stop_server;
    sigemptyset(&action.sa_mask);
    if (sigaction(SIGINT, &action, NULL) || sigaction(SIGTERM, &action, NULL)) {
        perror("sigaction"); sqlite3_close(db); return EXIT_FAILURE;
    }
    struct sockaddr_in address;
    memset(&address, 0, sizeof(address));
    address.sin_family = AF_INET;
    address.sin_port = htons((unsigned short)port);
    address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    struct MHD_Daemon *daemon = MHD_start_daemon(MHD_USE_INTERNAL_POLLING_THREAD,
        (unsigned short)port, NULL, NULL, handle_request, db,
        MHD_OPTION_SOCK_ADDR, &address,
        MHD_OPTION_CONNECTION_TIMEOUT, (unsigned int)15,
        MHD_OPTION_CONNECTION_LIMIT, (unsigned int)64,
        MHD_OPTION_NOTIFY_COMPLETED, request_completed, NULL,
        MHD_OPTION_END);
    if (!daemon) {
        fprintf(stderr, "Cannot start HTTP server\n"); sqlite3_close(db); return EXIT_FAILURE;
    }
    printf("Math backend: http://127.0.0.1:%ld\nDatabase: %s\n", port, db_path);
    fflush(stdout);
    const struct timespec delay = { 0, 200000000 };
    while (!stopping) nanosleep(&delay, NULL);
    MHD_stop_daemon(daemon);
    sqlite3_close(db);
    return EXIT_SUCCESS;
}
