#ifndef MATH_HTTP_H
#define MATH_HTTP_H
#include <microhttpd.h>
#include <sqlite3.h>
#if MHD_VERSION >= 0x00097100
typedef enum MHD_Result http_result;
#else
typedef int http_result;
#endif
struct json_buffer { char data[65536]; size_t length; };
http_result reply(struct MHD_Connection *, unsigned int, const char *);
int append(struct json_buffer *, const char *);
int append_json_string(struct json_buffer *, const unsigned char *);
http_result documents_get(sqlite3 *, struct MHD_Connection *, const char *);
http_result web_get(struct MHD_Connection *, const char *);
#endif
