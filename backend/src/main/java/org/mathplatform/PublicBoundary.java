package org.mathplatform;

import java.io.IOException;
import java.io.ByteArrayInputStream;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequestWrapper;
import java.sql.SQLException;
import java.util.Map;
import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
class PublicBoundary implements Filter {
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain) throws IOException, ServletException {
        var http = (HttpServletResponse) response;
        http.setHeader("Cache-Control", "no-store");
        http.setHeader("X-Content-Type-Options", "nosniff");
        http.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
        var incoming = (HttpServletRequest) request;
        boolean authWrite = incoming.getMethod().equals("POST") && java.util.Set.of("/api/auth/register", "/api/auth/login", "/api/auth/logout").contains(incoming.getRequestURI());
        String path = incoming.getRequestURI(); String method = incoming.getMethod();
        boolean learningWrite = (method.equals("PUT") && path.matches("/api/learning/books/[0-9]+/(progress|selection)"))
            || (method.equals("POST") && path.matches("/api/learning/books/[0-9]+/annotations"))
            || (java.util.Set.of("PATCH", "DELETE").contains(method) && path.matches("/api/learning/books/[0-9]+/annotations/[0-9]+"));
        learningWrite |= (method.equals("PUT") && path.matches("/api/library/documents/[0-9]+/progress"))
            || (method.equals("POST") && path.matches("/api/library/documents/[0-9]+/annotations"))
            || (java.util.Set.of("PATCH", "DELETE").contains(method) && path.matches("/api/library/documents/[0-9]+/annotations/[0-9]+"));
        boolean aiWrite = (method.equals("PUT") && java.util.Set.of("/api/ai/settings", "/api/admin/ai/settings").contains(path))
            || (method.equals("POST") && path.equals("/api/ai/chat"));
        boolean adminUpload = method.equals("POST") && path.equals("/api/admin/documents");
        boolean adminWrite = (method.equals("PATCH") && path.matches("/api/admin/documents/[0-9]+"))
            || (method.equals("PUT") && path.matches("/api/admin/books/[0-9]+"))
            || (method.equals("POST") && (path.equals("/api/admin/books") || path.equals("/api/admin/invitations") || path.matches("/api/admin/invitations/[a-f0-9]{64}/revoke")));
        adminWrite |= (method.equals("POST") && java.util.Set.of("/api/admin/collections", "/api/admin/documents/move", "/api/admin/documents/batch-delete").contains(path))
            || (java.util.Set.of("PATCH", "DELETE").contains(method) && path.matches("/api/admin/collections/[0-9]+"))
            || (method.equals("PUT") && path.matches("/api/admin/collections/[0-9]+/parent"))
            || (method.equals("PATCH") && path.matches("/api/admin/documents/[0-9]+/name"));
        if (!method.equals("GET") && !authWrite && !learningWrite && !adminWrite && !adminUpload && !aiWrite) {
            http.setStatus(405); http.setHeader("Allow", "GET"); http.setContentType("application/json; charset=utf-8");
            http.getWriter().write("{\"error\":\"method_not_allowed\"}"); return;
        }
        // Raw PDF uploads are read with a bound by the controller, after authorization.
        if (authWrite || learningWrite || adminWrite || aiWrite) {
            int limit = authWrite ? 8192 : path.equals("/api/ai/chat") ? 16777216 : 65536;
            byte[] body = incoming.getInputStream().readNBytes(limit + 1);
            if (body.length > limit) {
                http.setStatus(413); http.setContentType("application/json; charset=utf-8"); http.getWriter().write("{\"error\":\"request_too_large\"}"); return;
            }
            incoming = new HttpServletRequestWrapper(incoming) {
                @Override public int getContentLength() { return body.length; }
                @Override public long getContentLengthLong() { return body.length; }
                @Override public ServletInputStream getInputStream() {
                    var stream = new ByteArrayInputStream(body);
                    return new ServletInputStream() {
                        @Override public int read() { return stream.read(); }
                        @Override public boolean isFinished() { return stream.available() == 0; }
                        @Override public boolean isReady() { return true; }
                        @Override public void setReadListener(ReadListener listener) { throw new UnsupportedOperationException(); }
                    };
                }
            };
        }
        chain.doFilter(incoming, response);
    }
}

@RestControllerAdvice
class PublicErrors {
    @ExceptionHandler({org.springframework.http.converter.HttpMessageNotReadableException.class,
        org.springframework.web.bind.MissingServletRequestParameterException.class,
        org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class})
    org.springframework.http.ResponseEntity<Map<String, String>> invalid(Exception failure) {
        return org.springframework.http.ResponseEntity.status(400).body(Map.of("error", "invalid_request"));
    }
    @ExceptionHandler(ApiProblem.class)
    org.springframework.http.ResponseEntity<Map<String, String>> problem(ApiProblem failure) {
        return org.springframework.http.ResponseEntity.status(failure.status).body(Map.of("error", failure.code));
    }
    @ExceptionHandler(SQLException.class)
    org.springframework.http.ResponseEntity<Map<String, String>> database(SQLException failure) {
        return org.springframework.http.ResponseEntity.status(500).body(Map.of("error", "database_error"));
    }
}
