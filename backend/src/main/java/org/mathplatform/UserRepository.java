package org.mathplatform;

import java.nio.charset.StandardCharsets;
import java.sql.SQLException;
import java.util.Locale;
import java.util.Map;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Repository;

@Repository
public class UserRepository implements UserDetailsService {
    private final LibraryRepository database;
    UserRepository(LibraryRepository database) { this.database = database; }
    static String username(String value) {
        if (value == null || !value.matches("[A-Za-z0-9_]{3,32}")) throw new ApiProblem(400, "invalid_username");
        return value.toLowerCase(Locale.ROOT);
    }
    public Map<String, Object> register(String input, String password, PasswordEncoder encoder) throws SQLException {
        String name = username(input);
        if (password == null || password.codePointCount(0, password.length()) < 12 || password.getBytes(StandardCharsets.UTF_8).length > 72)
            throw new ApiProblem(400, "invalid_password");
        String hash = encoder.encode(password);
        try (var connection = database.connect(false); var statement = connection.prepareStatement("INSERT INTO users(username,password_hash) VALUES(?,?)")) {
            statement.setString(1, name); statement.setString(2, hash);
            try { statement.executeUpdate(); }
            catch (SQLException failure) { if (failure.getErrorCode() == 19) throw new ApiProblem(409, "username_taken"); throw failure; }
        }
        return Map.of("username", name, "role", "USER");
    }
    @Override
    public UserDetails loadUserByUsername(String input) throws UsernameNotFoundException {
        String name;
        try { name = username(input); } catch (ApiProblem failure) { throw new UsernameNotFoundException("Invalid credentials"); }
        try (var connection = database.connect(true); var statement = connection.prepareStatement("SELECT username,password_hash FROM users WHERE username=?")) {
            statement.setString(1, name);
            try (var row = statement.executeQuery()) {
                if (!row.next()) throw new UsernameNotFoundException("Invalid credentials");
                return User.withUsername(row.getString(1)).password(row.getString(2)).roles("USER").build();
            }
        } catch (SQLException failure) { throw new org.springframework.security.authentication.InternalAuthenticationServiceException("Account storage unavailable", failure); }
    }
}
