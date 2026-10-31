package org.mathplatform;

import jakarta.annotation.PostConstruct;
import java.sql.SQLException;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Single-user desktop mode. The application still uses the normal security chain,
 * but every loopback request is authenticated as the local administrator so the
 * packaged client does not ask a student to register or log in.
 */
@Component
class DesktopMode {
    static final boolean ENABLED = "1".equals(System.getenv("MATH_DESKTOP"));
    private final UserRepository users;
    private final PasswordEncoder passwords;

    DesktopMode(UserRepository users, PasswordEncoder passwords) {
        this.users = users;
        this.passwords = passwords;
    }

    @PostConstruct
    void createLocalAccount() {
        if (!ENABLED) return;
        try {
            users.ensureLocalAccount(passwords);
        } catch (SQLException failure) {
            throw new IllegalStateException("Cannot create the local desktop account", failure);
        }
    }
}

/** Installed just before authorization so controllers always see the local user. */
class DesktopAuthenticationFilter extends OncePerRequestFilter {
    private static final List<SimpleGrantedAuthority> AUTHORITIES = List.of(
        new SimpleGrantedAuthority("ROLE_USER"), new SimpleGrantedAuthority("ROLE_ADMIN"));

    @Override
    protected void doFilterInternal(jakarta.servlet.http.HttpServletRequest request,
                                    jakarta.servlet.http.HttpServletResponse response,
                                    jakarta.servlet.FilterChain chain) throws java.io.IOException, jakarta.servlet.ServletException {
        SecurityContextHolder.getContext().setAuthentication(
            UsernamePasswordAuthenticationToken.authenticated("local", "desktop", AUTHORITIES));
        chain.doFilter(request, response);
    }
}
