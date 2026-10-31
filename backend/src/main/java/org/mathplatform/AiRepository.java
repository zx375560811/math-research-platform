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
import java.util.List;
import java.util.Map;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Repository;

@Repository
public class AiRepository {
    static final List<String> PROMPT_ACTIONS = List.of("gap", "counterexample", "intuition", "translate", "summary", "practice");
    static final Map<String, String> DEFAULT_PROMPTS;
    static {
        var prompts = new LinkedHashMap<String, String>();
        prompts.put("gap", "请严格补全这段推导中省略的中间步骤（如“显然”、“易知”或跳过的计算），明确写出每一步所依据的定义、引理或定理及其适用条件。");
        prompts.put("counterexample", "如果减弱或去掉这段命题/定理中的关键假设条件，结论是否仍然成立？请逐一分析关键条件的作用，并构造具体的数学反例说明为什么不能省略。");
        prompts.put("intuition", "请跳出纯符号形式化推导，用几何直观、低维特例（如 ℝ²、ℝ³ 或有限维情形）或具体例子解释这段抽象概念/定理背后的核心数学动机与图像。");
        prompts.put("translate", "请把选中的这段内容翻译成中文。保留数学符号、公式、定理编号、人名、书名和术语；公式用 LaTeX 表示；只输出译文，不要解释或总结。\n\n");
        prompts.put("summary", "请用中文简洁总结这段内容的核心定义、主要结论和关键条件，分点列出，不补充原文没有的内容。");
        prompts.put("practice", "请根据这段内容设计 2 道由易到难的练习题，覆盖关键概念和方法；先只给题目，不要给答案。");
        DEFAULT_PROMPTS = Map.copyOf(prompts);
    }
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
    Map<String, String> prompts(String username) throws SQLException {
        var values = new LinkedHashMap<String, String>(DEFAULT_PROMPTS);
        try (var db = library.connect(true); var query = db.prepareStatement("SELECT action,prompt FROM ai_prompt_templates WHERE username=?")) {
            query.setString(1, username);
            try (var row = query.executeQuery()) {
                while (row.next()) if (DEFAULT_PROMPTS.containsKey(row.getString(1))) values.put(row.getString(1), row.getString(2));
            }
        }
        return values;
    }
    void savePrompts(String username, Map<String, String> prompts) throws SQLException {
        try (var db = library.connect(false)) {
            db.setAutoCommit(false);
            try (var clear = db.prepareStatement("DELETE FROM ai_prompt_templates WHERE username=?")) {
                clear.setString(1, username); clear.executeUpdate();
            }
            try (var insert = db.prepareStatement("INSERT INTO ai_prompt_templates(username,action,prompt) VALUES(?,?,?)")) {
                for (String action : PROMPT_ACTIONS) {
                    insert.setString(1, username); insert.setString(2, action); insert.setString(3, prompts.get(action)); insert.executeUpdate();
                }
            }
            db.commit();
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
