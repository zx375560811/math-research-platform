package org.mathplatform;

import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.PosixFilePermissions;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Repository;

@Repository
public class AiRepository {
    record Provider(String baseUrl, String model, String key, boolean enabled, int dailyLimit) {
        boolean available() { return enabled && !baseUrl.isBlank() && !model.isBlank() && !key.isBlank(); }
        Map<String, Object> summary(boolean address) {
            var out = new LinkedHashMap<String, Object>();
            out.put("enabled", enabled); out.put("available", available()); out.put("model", model);
            out.put("has_key", !key.isBlank()); out.put("daily_limit", dailyLimit);
            if (address) out.put("base_url", baseUrl);
            return out;
        }
    }
    private final LibraryRepository library;
    private final SecretKeySpec secret;
    private final SecureRandom random = new SecureRandom();
    AiRepository(LibraryRepository library) throws IOException {
        this.library = library;
        Path parent = Path.of(LibraryRepository.setting("MATH_DB_PATH", "data/math.db")).toAbsolutePath().getParent();
        Path file = parent.resolve("ai-secret.key");
        if (!Files.exists(file, LinkOption.NOFOLLOW_LINKS)) {
            byte[] bytes = new byte[32]; random.nextBytes(bytes);
            // Permissions apply at creation, before any key material is written.
            try { Files.createFile(file, PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rw-------"))); }
            catch (UnsupportedOperationException ignored) { Files.createFile(file); }
            Files.write(file, bytes, StandardOpenOption.WRITE, LinkOption.NOFOLLOW_LINKS);
        }
        if (!Files.isRegularFile(file, LinkOption.NOFOLLOW_LINKS)) throw new IOException("Invalid AI encryption key file");
        byte[] bytes = Files.readAllBytes(file);
        if (bytes.length != 32) throw new IOException("Invalid AI encryption key length");
        secret = new SecretKeySpec(bytes, "AES");
    }
    private String encrypt(String text) {
        if (text.isEmpty()) return "";
        try {
            byte[] iv = new byte[12]; random.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, secret, new GCMParameterSpec(128, iv));
            byte[] encrypted = cipher.doFinal(text.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            byte[] joined = new byte[iv.length + encrypted.length];
            System.arraycopy(iv, 0, joined, 0, iv.length); System.arraycopy(encrypted, 0, joined, iv.length, encrypted.length);
            return Base64.getEncoder().encodeToString(joined);
        } catch (GeneralSecurityException failure) { throw new ApiProblem(503, "ai_key_unavailable"); }
    }
    private String decrypt(String value) {
        if (value.isEmpty()) return "";
        try {
            byte[] bytes = Base64.getDecoder().decode(value);
            if (bytes.length < 28) throw new GeneralSecurityException();
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, secret, new GCMParameterSpec(128, bytes, 0, 12));
            return new String(cipher.doFinal(bytes, 12, bytes.length - 12), java.nio.charset.StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | IllegalArgumentException failure) { throw new ApiProblem(503, "ai_key_unavailable"); }
    }
    Provider provider(String username) throws SQLException {
        try (var db = library.connect(true); var query = db.prepareStatement("SELECT * FROM ai_provider_settings WHERE owner=?")) {
            query.setString(1, username == null ? "default" : "user:" + username);
            try (var row = query.executeQuery()) {
                if (!row.next()) return new Provider("", "", "", false, 50);
                return new Provider(row.getString("base_url"), row.getString("model"), decrypt(row.getString("api_key")), row.getInt("enabled") != 0, row.getInt("daily_limit"));
            }
        }
    }
    String source(String username) throws SQLException {
        try (var db = library.connect(true); var query = db.prepareStatement("SELECT source FROM ai_preferences WHERE username=?")) {
            query.setString(1, username); try (var row = query.executeQuery()) { return row.next() ? row.getString(1) : "default"; }
        }
    }
    void save(String username, Provider provider, String source) throws SQLException {
        try (var db = library.connect(false)) {
            db.setAutoCommit(false);
            try (var query = db.prepareStatement("INSERT INTO ai_provider_settings(owner,username,base_url,model,api_key,enabled,daily_limit) VALUES(?,?,?,?,?,?,?) ON CONFLICT(owner) DO UPDATE SET base_url=excluded.base_url,model=excluded.model,api_key=excluded.api_key,enabled=excluded.enabled,daily_limit=excluded.daily_limit")) {
                query.setString(1, username == null ? "default" : "user:" + username); query.setString(2, username);
                query.setString(3, provider.baseUrl()); query.setString(4, provider.model()); query.setString(5, encrypt(provider.key()));
                query.setInt(6, provider.enabled() ? 1 : 0); query.setInt(7, provider.dailyLimit()); query.executeUpdate();
            }
            if (username != null) try (var query = db.prepareStatement("INSERT INTO ai_preferences VALUES(?,?) ON CONFLICT(username) DO UPDATE SET source=excluded.source")) {
                query.setString(1, username); query.setString(2, source); query.executeUpdate();
            }
            db.commit();
        }
    }
    // Reserve a request atomically. Failed upstream attempts still count to bound expenditure.
    void reserve(String username, int dailyLimit) throws SQLException {
        String day = LocalDate.now(ZoneOffset.UTC).toString(); long minute = System.currentTimeMillis() / 60000;
        try (var db = library.connect(false); var statement = db.createStatement()) {
            statement.execute("BEGIN IMMEDIATE");
            try {
                int daily = 0, recent = 0;
                try (var query = db.prepareStatement("SELECT * FROM ai_usage WHERE username=?")) {
                    query.setString(1, username);
                    try (var row = query.executeQuery()) {
                        if (row.next()) { if (day.equals(row.getString("day"))) daily = row.getInt("daily_count"); if (minute == row.getLong("minute")) recent = row.getInt("minute_count"); }
                    }
                }
                if (recent >= 6) throw new ApiProblem(429, "ai_rate_limit");
                if (dailyLimit > 0 && daily >= dailyLimit) throw new ApiProblem(429, "ai_daily_limit");
                try (var query = db.prepareStatement("INSERT INTO ai_usage VALUES(?,?,?,?,?) ON CONFLICT(username) DO UPDATE SET day=excluded.day,daily_count=excluded.daily_count,minute=excluded.minute,minute_count=excluded.minute_count")) {
                    query.setString(1, username); query.setString(2, day); query.setInt(3, daily + (dailyLimit > 0 ? 1 : 0)); query.setLong(4, minute); query.setInt(5, recent + 1); query.executeUpdate();
                }
                statement.execute("COMMIT");
            } catch (SQLException | RuntimeException failure) { statement.execute("ROLLBACK"); throw failure; }
        }
    }
}
