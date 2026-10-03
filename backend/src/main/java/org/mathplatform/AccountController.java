package org.mathplatform;

import java.nio.charset.StandardCharsets;
import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.Map;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfAuthenticationStrategy;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AccountController {
    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final AuthenticationManager authentication;
    private final SecurityContextRepository contexts;
    private final Map<String, Attempt> attempts = new LinkedHashMap<>();
    private record Attempt(long start, int count) {}
    public record Credentials(String username, String password, String invitation) {}
    AccountController(UserRepository users, PasswordEncoder passwords, AuthenticationManager authentication, SecurityContextRepository contexts) {
        this.users = users; this.passwords = passwords; this.authentication = authentication; this.contexts = contexts;
    }
    private synchronized void limit(String key, int maximum, long window) {
        long now = System.currentTimeMillis();
        Attempt old = attempts.get(key);
        int count = old == null || now - old.start > window ? 0 : old.count;
        if (count >= maximum) throw new ApiProblem(429, "too_many_attempts");
        if (attempts.size() >= 10000 && !attempts.containsKey(key)) attempts.remove(attempts.keySet().iterator().next());
        attempts.put(key, new Attempt(count == 0 ? now : old.start, count + 1));
    }
    @GetMapping("/api/auth/csrf")
    public Map<String, String> csrf(CsrfToken token) { return Map.of("header", token.getHeaderName(), "token", token.getToken()); }
    @GetMapping("/api/auth/me")
    public Map<String, Object> me(Authentication user) throws SQLException {
        if (user == null || user instanceof org.springframework.security.authentication.AnonymousAuthenticationToken) return Map.of("authenticated", false);
        return Map.of("authenticated", true, "user", identity(user));
    }
    private Map<String, String> identity(Authentication user) throws SQLException {
        return Map.of("username", user.getName(), "role", users.isAdmin(user.getName()) ? "ADMIN" : "USER");
    }
    @PostMapping("/api/auth/register")
    public ResponseEntity<Map<String, Object>> register(@RequestBody Credentials credentials, HttpServletRequest request) throws SQLException {
        limit("register:" + request.getRemoteAddr(), 10, 3600000);
        return ResponseEntity.status(201).body(Map.of("user", users.register(credentials.username, credentials.password, credentials.invitation, passwords)));
    }
    @PostMapping("/api/auth/login")
    public Map<String, Object> login(@RequestBody Credentials credentials, HttpServletRequest request, HttpServletResponse response) throws SQLException {
        limit("login:" + request.getRemoteAddr(), 30, 900000);
        if (credentials.password == null || credentials.password.getBytes(StandardCharsets.UTF_8).length > 72) throw new ApiProblem(401, "invalid_credentials");
        Authentication user;
        try { user = authentication.authenticate(UsernamePasswordAuthenticationToken.unauthenticated(credentials.username, credentials.password)); }
        catch (AuthenticationException failure) { throw new ApiProblem(401, "invalid_credentials"); }
        if (request.getSession(false) != null) request.changeSessionId();
        new CsrfAuthenticationStrategy(new HttpSessionCsrfTokenRepository()).onAuthentication(user, request, response);
        var context = SecurityContextHolder.createEmptyContext(); context.setAuthentication(user);
        SecurityContextHolder.setContext(context); contexts.saveContext(context, request, response);
        return Map.of("user", identity(user));
    }
}
