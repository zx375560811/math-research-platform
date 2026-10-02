package org.mathplatform;

import java.io.IOException;
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
        http.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
        var incoming = (HttpServletRequest) request;
        boolean authWrite = incoming.getMethod().equals("POST") && java.util.Set.of("/api/auth/register", "/api/auth/login", "/api/auth/logout").contains(incoming.getRequestURI());
        if (authWrite && incoming.getContentLengthLong() > 8192) {
            http.setStatus(413); http.setContentType("application/json; charset=utf-8");
            http.getWriter().write("{\"error\":\"request_too_large\"}"); return;
        }
        if (!incoming.getMethod().equals("GET") && !authWrite) {
            http.setStatus(405); http.setHeader("Allow", "GET"); http.setContentType("application/json; charset=utf-8");
            http.getWriter().write("{\"error\":\"method_not_allowed\"}"); return;
        }
        chain.doFilter(request, response);
    }
}

@RestControllerAdvice
class PublicErrors {
    @ExceptionHandler(ApiProblem.class)
    org.springframework.http.ResponseEntity<Map<String, String>> problem(ApiProblem failure) {
        return org.springframework.http.ResponseEntity.status(failure.status).body(Map.of("error", failure.code));
    }
    @ExceptionHandler(SQLException.class)
    org.springframework.http.ResponseEntity<Map<String, String>> database(SQLException failure) {
        return org.springframework.http.ResponseEntity.status(500).body(Map.of("error", "database_error"));
    }
}
