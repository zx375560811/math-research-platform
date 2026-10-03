package org.mathplatform;

import java.sql.SQLException;
import java.util.Map;
import java.util.Set;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
public class AiController {
    record Settings(String source, boolean enabled, String base_url, String model, String api_key, boolean clear_key, Integer daily_limit) {}
    private final AiRepository settings;
    private final AiService service;
    private final UserRepository users;
    AiController(AiRepository settings, AiService service, UserRepository users) { this.settings = settings; this.service = service; this.users = users; }
    @GetMapping({"/api/ai/settings", "/api/ai/status"})
    public Map<String, Object> settings(Authentication user) throws SQLException {
        var custom = settings.provider(user.getName()); var fallback = settings.provider(null);
        String source = settings.source(user.getName());
        return Map.of("source", source, "custom", custom.summary(true), "default", fallback.summary(false),
            "enabled", (source.equals("custom") ? custom : fallback).available());
    }
    @PutMapping("/api/ai/settings")
    public Map<String, Object> save(Authentication user, @RequestBody Settings body) throws SQLException {
        if (body == null || !Set.of("custom", "default").contains(body.source() == null ? "" : body.source())) throw new ApiProblem(400, "ai_invalid_settings");
        settings.save(user.getName(), validated(body, settings.provider(user.getName()), false), body.source());
        return settings(user);
    }
    private AiRepository.Provider validated(Settings body, AiRepository.Provider old, boolean admin) {
        String url = body.base_url() == null ? "" : body.base_url().trim();
        String model = body.model() == null ? "" : body.model().trim();
        String input = body.api_key() == null ? "" : body.api_key().trim();
        if (model.length() > 200 || model.codePoints().anyMatch(c -> c < 32 || c == 127) || input.length() > 4096 || input.codePoints().anyMatch(c -> c < 33 || c > 126)
            || (body.clear_key() && !input.isEmpty())) throw new ApiProblem(400, "ai_invalid_settings");
        if (!url.isEmpty()) service.endpoint(url);
        String key = body.clear_key() ? "" : input.isEmpty() ? old.key() : input;
        int limit = admin && body.daily_limit() != null ? body.daily_limit() : old.dailyLimit();
        if (limit < 1 || limit > 1000 || (body.enabled() && (url.isEmpty() || model.isEmpty() || key.isEmpty()))) throw new ApiProblem(400, "ai_invalid_settings");
        return new AiRepository.Provider(url, model, key, body.enabled(), limit);
    }
    @PostMapping("/api/ai/chat")
    public Map<String, String> chat(Authentication user, @RequestBody AiService.Chat body) throws SQLException {
        return Map.of("reply", service.chat(user.getName(), body));
    }
    private void authorize(Authentication user) throws SQLException {
        if (user == null || !users.isAdmin(user.getName())) throw new ApiProblem(403, "admin_required");
    }
    @GetMapping("/api/admin/ai/settings")
    public Map<String, Object> adminSettings(Authentication user) throws SQLException {
        authorize(user); return settings.provider(null).summary(true);
    }
    @PutMapping("/api/admin/ai/settings")
    public Map<String, Object> adminSave(Authentication user, @RequestBody Settings body) throws SQLException {
        authorize(user);
        if (body == null) throw new ApiProblem(400, "ai_invalid_settings");
        settings.save(null, validated(body, settings.provider(null), true), "default");
        return adminSettings(user);
    }
}
