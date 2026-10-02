#define _POSIX_C_SOURCE 200809L
#include "http.h"
#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>

http_result web_get(struct MHD_Connection *connection, const char *url)
{
    const char *name, *type;
    if (!strcmp(url, "/") || !strcmp(url, "/index.html")) {
        name = "index.html"; type = "text/html; charset=utf-8";
    } else if (!strcmp(url, "/app.js")) {
        name = "app.js"; type = "text/javascript; charset=utf-8";
    } else if (!strcmp(url, "/icons.js")) {
        name = "icons.js"; type = "text/javascript; charset=utf-8";
    } else if (!strcmp(url, "/vendor/morphicons/dom.js")) {
        name = "vendor/morphicons/dom.js"; type = "text/javascript; charset=utf-8";
    } else if (!strcmp(url, "/vendor/morphicons/spring-CFHloqPP.js")) {
        name = "vendor/morphicons/spring-CFHloqPP.js"; type = "text/javascript; charset=utf-8";
    } else if (!strcmp(url, "/vendor/morphicons/normalize-CYnN3Npw.js")) {
        name = "vendor/morphicons/normalize-CYnN3Npw.js"; type = "text/javascript; charset=utf-8";
    } else if (!strcmp(url, "/style.css")) {
        name = "style.css"; type = "text/css; charset=utf-8";
    } else return reply(connection, 404, "{\"error\":\"not_found\"}");
    const char *root = getenv("MATH_WEB_DIR");
    if (!root || !*root) root = "../frontend";
    char path[4096];
    int length = snprintf(path, sizeof(path), "%s/%s", root, name);
    if (length < 0 || (size_t)length >= sizeof(path))
        return reply(connection, 500, "{\"error\":\"web_unavailable\"}");
    int fd = open(path, O_RDONLY | O_NOFOLLOW);
    if (fd < 0) return reply(connection, 503, "{\"error\":\"web_unavailable\"}");
    struct stat st;
    if (fstat(fd, &st) || !S_ISREG(st.st_mode) || st.st_size < 0 || st.st_size > 2097152) {
        close(fd); return reply(connection, 503, "{\"error\":\"web_unavailable\"}");
    }
    struct MHD_Response *response = MHD_create_response_from_fd((size_t)st.st_size, fd);
    if (!response) { close(fd); return MHD_NO; }
    MHD_add_response_header(response, "Content-Type", type);
    MHD_add_response_header(response, "Cache-Control", "no-store");
    MHD_add_response_header(response, "X-Content-Type-Options", "nosniff");
    MHD_add_response_header(response, "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; "
        "connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    http_result result = MHD_queue_response(connection, 200, response);
    MHD_destroy_response(response);
    return result;
}
