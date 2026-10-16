package org.mathplatform;

import java.io.IOException;
import java.net.URI;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.ObjectMapper;

/** Source metadata is separate from library documents; references never duplicate files. */
@RestController
public class CompetitionResourceController {
    private final LibraryRepository library;
    private final DocumentReadingRepository reading;
    private final UserRepository users;

    CompetitionResourceController(LibraryRepository library, DocumentReadingRepository reading, UserRepository users) throws IOException, SQLException {
        this.library = library; this.reading = reading; this.users = users;
        try (var source = getClass().getResourceAsStream("/competition-resources.json")) {
            if (source == null) throw new IOException("Missing competition-resources.json");
            var catalogue = new ObjectMapper().readTree(source);
            try (var db = library.connect(false); var q = db.prepareStatement("INSERT OR IGNORE INTO competition_resources(id,title,stage,group_key,year,edition,kind,source_url,download_url,sort_order) VALUES(?,?,?,?,?,?,?,?,?,?)")) {
                db.setAutoCommit(false);
                int order = 0;
                for (var row : catalogue.path("resources")) {
                    String[] values = {row.path("id").asString(), row.path("title").asString(), row.path("stage").asString(), row.path("group_key").asString()};
                    for (int i = 0; i < values.length; i++) q.setString(i + 1, values[i]);
                    q.setInt(5, row.path("year").asInt()); q.setInt(6, row.path("edition").asInt());
                    q.setString(7, row.path("kind").asString()); q.setString(8, row.path("source_url").asString());
                    q.setString(9, row.path("download_url").asString()); q.setInt(10, order++); q.executeUpdate();
                }
                db.commit();
            }
        }
    }
    private void admin(Authentication user) throws SQLException {
        if (!users.isAdmin(user.getName())) throw new ApiProblem(403, "admin_required");
    }
    @GetMapping("/api/competition/resources")
    public Map<String,Object> publicResources(Authentication user) throws SQLException { return list(user, false); }
    @GetMapping("/api/admin/competition/resources")
    public Map<String,Object> adminResources(Authentication user) throws SQLException { admin(user); return list(user, true); }
    private Map<String,Object> list(Authentication user, boolean admin) throws SQLException {
        var values = new ArrayList<Map<String,Object>>();
        try (var db = library.connect(true); var q = db.createStatement(); var rows = q.executeQuery("SELECT * FROM competition_resources" + (admin ? "" : " WHERE visible=1") + " ORDER BY year DESC,edition DESC,sort_order,id")) {
            while (rows.next()) {
                var value = new LinkedHashMap<String,Object>();
                for (String key : new String[]{"id","title","stage","group_key","kind","source_url","download_url"}) value.put(key, rows.getString(key));
                value.put("year", rows.getInt("year")); value.put("edition", rows.getInt("edition"));
                value.put("visible", rows.getInt("visible") == 1);
                long document = rows.getLong("document_id");
                value.put("document", rows.wasNull() ? null : reading.reading(document, user.getName()));
                values.add(value);
            }
        }
        return Map.of("resources", values);
    }
    public record Metadata(String title, String stage, String group_key, Integer year, Integer edition, String kind, String source_url, Boolean visible) {}
    private static void validate(Metadata value) {
        if (value == null || value.title() == null || value.title().isBlank() || value.title().length() > 200 || value.title().chars().anyMatch(c -> c < 32) || value.year() == null || value.year() != 0 && (value.year() < 2009 || value.year() > 2100) || value.edition() == null || value.edition() < 0 || value.edition() > 100 || value.stage() == null || value.group_key() == null || value.kind() == null || value.source_url() == null || value.source_url().length() > 2000) throw new ApiProblem(400, "invalid_query");
        boolean valid = value.stage().equals("syllabus") && value.group_key().equals("common") && value.kind().equals("syllabus")
            || value.stage().equals("preliminary") && Set.of("a","b").contains(value.group_key()) && Set.of("paper","answer","combined").contains(value.kind())
            || value.stage().equals("final") && Set.of("junior","senior").contains(value.group_key()) && Set.of("paper","answer","combined").contains(value.kind());
        if (!valid) throw new ApiProblem(400, "invalid_query");
        if (!value.source_url().isBlank()) {
            try { var uri = URI.create(value.source_url()); if (!"https".equals(uri.getScheme()) || uri.getHost() == null || uri.getRawUserInfo() != null) throw new IllegalArgumentException(); }
            catch (IllegalArgumentException error) { throw new ApiProblem(400, "invalid_query"); }
        }
    }
    @PostMapping("/api/admin/competition/resources")
    public Map<String,String> create(Authentication user, @RequestBody Metadata value) throws SQLException {
        admin(user); validate(value); String id = UUID.randomUUID().toString();
        try (var db = library.connect(false); var q = db.prepareStatement("INSERT INTO competition_resources(id,title,stage,group_key,year,edition,kind,source_url,visible) VALUES(?,?,?,?,?,?,?,?,?)")) {
            q.setString(1, id); q.setString(2, value.title().trim()); q.setString(3, value.stage()); q.setString(4, value.group_key()); q.setInt(5, value.year()); q.setInt(6, value.edition()); q.setString(7, value.kind()); q.setString(8, value.source_url()); q.setInt(9, Boolean.FALSE.equals(value.visible()) ? 0 : 1); q.executeUpdate();
        }
        return Map.of("id", id);
    }
    @PatchMapping("/api/admin/competition/resources/{id}")
    public Map<String,String> update(Authentication user, @PathVariable String id, @RequestBody Metadata value) throws SQLException {
        admin(user); validate(value);
        try (var db = library.connect(false); var q = db.prepareStatement("UPDATE competition_resources SET title=?,stage=?,group_key=?,year=?,edition=?,kind=?,source_url=?,visible=? WHERE id=?")) {
            q.setString(1, value.title().trim()); q.setString(2, value.stage()); q.setString(3, value.group_key()); q.setInt(4, value.year()); q.setInt(5, value.edition()); q.setString(6, value.kind()); q.setString(7, value.source_url()); q.setInt(8, Boolean.FALSE.equals(value.visible()) ? 0 : 1); q.setString(9, id);
            if (q.executeUpdate() == 0) throw new ApiProblem(404, "not_found");
        }
        return Map.of("status", "ok");
    }
    public record Document(Long document_id) {}
    @PutMapping("/api/admin/competition/resources/{id}/document")
    public Map<String,String> bind(Authentication user, @PathVariable String id, @RequestBody Document value) throws SQLException {
        admin(user); if (value == null) throw new ApiProblem(400, "invalid_query");
        if (value.document_id() != null) library.document(value.document_id());
        try (var db = library.connect(false); var q = db.prepareStatement("UPDATE competition_resources SET document_id=? WHERE id=?")) {
            if (value.document_id() == null) q.setNull(1, java.sql.Types.INTEGER); else q.setLong(1, value.document_id());
            q.setString(2, id); if (q.executeUpdate() == 0) throw new ApiProblem(404, "not_found");
        }
        return Map.of("status", "ok");
    }
}
