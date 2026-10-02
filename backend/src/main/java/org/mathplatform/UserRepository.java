package org.mathplatform;

import java.nio.charset.StandardCharsets;
import java.sql.SQLException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
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
    static String invitationHash(String code) {
        if (code == null || !code.matches("[A-Za-z0-9_-]{43}")) throw new ApiProblem(400, "invalid_invitation");
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(code.getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException failure) { throw new IllegalStateException(failure); }
    }
    public Map<String, Object> register(String input, String password, String invitation, PasswordEncoder encoder) throws SQLException {
        String name = username(input);
        if (password == null || password.codePointCount(0, password.length()) < 12 || password.getBytes(StandardCharsets.UTF_8).length > 72)
            throw new ApiProblem(400, "invalid_password");
        String codeHash = invitationHash(invitation);
        String hash = encoder.encode(password);
        try (var connection = database.connect(false); var transaction = connection.createStatement()) {
            transaction.execute("BEGIN IMMEDIATE");
            try {
                try (var claim = connection.prepareStatement("UPDATE invitations SET used_at=strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE code_hash=? AND used_at IS NULL AND (expires_at IS NULL OR expires_at>CAST(strftime('%s','now') AS INTEGER))")) {
                    claim.setString(1, codeHash);
                    if (claim.executeUpdate() != 1) throw new ApiProblem(400, "invalid_invitation");
                }
                try (var statement = connection.prepareStatement("INSERT INTO users(username,password_hash) VALUES(?,?)")) {
                    statement.setString(1, name); statement.setString(2, hash);
                    try { statement.executeUpdate(); }
                    catch (SQLException failure) { if (failure.getErrorCode() == 19) throw new ApiProblem(409, "username_taken"); throw failure; }
                }
                try (var statement = connection.prepareStatement("UPDATE invitations SET used_by=? WHERE code_hash=?")) {
                    statement.setString(1, name); statement.setString(2, codeHash); statement.executeUpdate();
                }
                transaction.execute("COMMIT");
            } catch (SQLException | RuntimeException failure) { transaction.execute("ROLLBACK"); throw failure; }
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
