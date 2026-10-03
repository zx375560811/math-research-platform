package org.mathplatform;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;

@Configuration
public class SecurityConfiguration {
    @Bean PasswordEncoder passwords() { return new BCryptPasswordEncoder(11); }
    @Bean SecurityContextRepository contexts() { return new HttpSessionSecurityContextRepository(); }
    @Bean AuthenticationManager authentication(UserRepository users, PasswordEncoder encoder) {
        var provider = new DaoAuthenticationProvider(users);
        provider.setPasswordEncoder(encoder);
        return new ProviderManager(provider);
    }
    @Bean SecurityFilterChain security(HttpSecurity http, SecurityContextRepository repository) throws Exception {
        http.securityContext(context -> context.securityContextRepository(repository))
            .csrf(csrf -> csrf.csrfTokenRepository(new HttpSessionCsrfTokenRepository()))
            .authorizeHttpRequests(requests -> requests.requestMatchers("/api/auth/**", "/api/health").permitAll().requestMatchers("/api/admin/**", "/admin", "/admin/").hasRole("ADMIN").requestMatchers("/api/**").authenticated().anyRequest().permitAll())
            .formLogin(form -> form.disable()).httpBasic(basic -> basic.disable())
            .requestCache(cache -> cache.disable())
            .exceptionHandling(errors -> errors.authenticationEntryPoint((request, response, failure) -> {
                if (request.getRequestURI().equals("/admin") || request.getRequestURI().equals("/admin/")) { response.sendRedirect("/#/admin"); return; }
                response.setStatus(401); response.setContentType("application/json; charset=utf-8"); response.getWriter().write("{\"error\":\"login_required\"}");
            }).accessDeniedHandler((request, response, failure) -> {
                response.setStatus(403); response.setContentType("application/json; charset=utf-8"); response.getWriter().write(failure instanceof org.springframework.security.web.csrf.CsrfException ? "{\"error\":\"invalid_csrf\"}" : "{\"error\":\"admin_required\"}");
            }))
            .logout(logout -> logout.logoutUrl("/api/auth/logout").invalidateHttpSession(true).deleteCookies("JSESSIONID").logoutSuccessHandler((request, response, authentication) -> {
                response.setContentType("application/json; charset=utf-8"); response.getWriter().write("{\"status\":\"ok\"}");
            }));
        return http.build();
    }
}
