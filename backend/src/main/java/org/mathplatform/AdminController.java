package org.mathplatform;

import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermissions;
import java.security.SecureRandom;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin")
public class AdminController {
    private final LibraryRepository library;
    private final UserRepository users;
    private final CatalogRepository catalog;
    AdminController(LibraryRepository library, UserRepository users, CatalogRepository catalog) { this.library = library; this.users = users; this.catalog = catalog; }
    private void authorize(Authentication user) throws SQLException {
        // Recheck storage so removing administrator access also invalidates an existing session.
        if (user == null || !users.isAdmin(user.getName())) throw new ApiProblem(403, "admin_required");
    }
    private static String text(String value, boolean required) {
        if (value == null || value.getBytes(StandardCharsets.UTF_8).length > 500 || value.codePoints().anyMatch(c -> c < 32 || c == 127) || (required && value.isBlank()))
            throw new ApiProblem(400, "invalid_metadata");
        return value.trim();
    }
    private static void subjects(Connection db, List<Long> ids) throws SQLException {
        if (ids == null || ids.isEmpty() || ids.size() > 5 || ids.stream().anyMatch(java.util.Objects::isNull) || Set.copyOf(ids).size() != ids.size()) throw new ApiProblem(400, "invalid_subject");
        try (var query = db.prepareStatement("SELECT 1 FROM subjects WHERE id=?")) {
            for (Long id : ids) { query.setLong(1, id); try (var result = query.executeQuery()) { if (!result.next()) throw new ApiProblem(400, "invalid_subject"); } }
        }
    }
    private static void links(Connection db, long id, List<Long> subjects) throws SQLException {
        try (var insert = db.prepareStatement("INSERT INTO document_subjects VALUES(?,?)")) {
            for (long subject : subjects) { insert.setLong(1, id); insert.setLong(2, subject); insert.executeUpdate(); }
        }
    }
    @GetMapping("/documents")
    public Map<String, Object> documents(Authentication user, @RequestParam(defaultValue="0") int offset, @RequestParam(defaultValue="") String q,
            @RequestParam(defaultValue="") String direction, @RequestParam(defaultValue="") String language, @RequestParam(defaultValue="") String module, @RequestParam(defaultValue="") String collection) throws SQLException {
        authorize(user);
        return catalog.documents(module, direction, language, q, offset, user.getName(),collection);
    }
    @PostMapping("/documents")
    public ResponseEntity<Map<String, Object>> upload(Authentication user, HttpServletRequest request,
            @RequestParam String title, @RequestParam(defaultValue="") String authors, @RequestParam long subject_id,
            @RequestParam(defaultValue="mathematics") String module, @RequestParam(defaultValue="und") String language, @RequestParam(required=false) String direction, @RequestParam(required=false) List<String> directions) throws SQLException, IOException {
        authorize(user); title = text(title, true); authors = text(authors, false);
        if (!Set.of("application/pdf", "image/vnd.djvu", "image/x-djvu", "application/octet-stream").contains(request.getContentType() == null ? "" : request.getContentType().toLowerCase(java.util.Locale.ROOT))) throw new ApiProblem(400, "invalid_document");
        Path saved = null; boolean committed = false;
        try (var input = request.getInputStream()) {
            byte[] header = input.readNBytes(16);
            String format;
            try { format = DocumentFormat.detect(header); }
            catch (ApiProblem failure) { throw new ApiProblem(400, "application/pdf".equalsIgnoreCase(request.getContentType()) ? "invalid_pdf" : "invalid_document"); }
            try { saved = Files.createTempFile(Path.of("data/files"), "upload-", "", PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rw-------"))); }
            catch (UnsupportedOperationException failure) { saved = Files.createTempFile(Path.of("data/files"), "upload-", ""); }
            long fileSize;
            // Stream before opening the write transaction: bounded memory, no database lock during upload.
            try (var output = java.nio.channels.FileChannel.open(saved, java.nio.file.StandardOpenOption.WRITE)) {
                var stream = java.nio.channels.Channels.newOutputStream(output);
                stream.write(header);
                fileSize = header.length + input.transferTo(stream);
                output.force(true);
            }
            try (var db = library.connect(false); var transaction = db.createStatement()) {
                transaction.execute("BEGIN IMMEDIATE");
                try {
                    subjects(db, List.of(subject_id));
                    try (var insert = db.prepareStatement("INSERT INTO documents(title,authors,file_path,file_size) VALUES(?,?,?,?)")) {
                        insert.setString(1, title); insert.setString(2, authors); insert.setString(3, "data/files/" + saved.getFileName()); insert.setLong(4, fileSize); insert.executeUpdate();
                    }
                    long id;
                    try (var result = transaction.executeQuery("SELECT last_insert_rowid()")) { result.next(); id = result.getLong(1); }
                    try (var insert = db.prepareStatement("INSERT INTO document_formats VALUES(?,?)")) { insert.setLong(1,id); insert.setString(2,format); insert.executeUpdate(); }
                    links(db, id, List.of(subject_id));
                    CatalogRepository.classify(db, id, module, language, directions != null ? directions : direction == null ? directionsForSubjects(db, List.of(subject_id)) : List.of(direction));
                    transaction.execute("COMMIT"); committed = true;
                    return ResponseEntity.status(201).body(Map.of("id", id, "file_url", "/api/documents/" + id + "/file"));
                } catch (SQLException | RuntimeException failure) { transaction.execute("ROLLBACK"); throw failure; }
            }
        } finally { if (!committed && saved != null) Files.deleteIfExists(saved); }
    }
    private static List<String> directionsForSubjects(Connection db, List<Long> subjects) throws SQLException {
        var directions = new ArrayList<String>();
        try (var query = db.prepareStatement("SELECT d.slug FROM subjects s JOIN learning_directions d ON d.slug=s.slug WHERE s.id=?")) { for (long subject : subjects) { query.setLong(1, subject); try (var rows = query.executeQuery()) { while (rows.next()) directions.add(rows.getString(1)); } } }
        return directions;
    }
    public record Metadata(String title, String authors, List<Long> subject_ids, String module, String language, List<String> directions) {}
    @PatchMapping("/documents/{id}")
    public Map<String, String> editDocument(Authentication user, @PathVariable long id, @RequestBody Metadata value) throws SQLException {
        authorize(user); String title = text(value.title, true), authors = text(value.authors, false);
        try (var db = library.connect(false); var transaction = db.createStatement()) {
            transaction.execute("BEGIN IMMEDIATE");
            try {
                subjects(db, value.subject_ids);
                try (var update = db.prepareStatement("UPDATE documents SET title=?,authors=? WHERE id=?")) {
                    update.setString(1, title); update.setString(2, authors); update.setLong(3, id);
                    if (update.executeUpdate() != 1) throw new ApiProblem(404, "not_found");
                }
                try (var delete = db.prepareStatement("DELETE FROM document_subjects WHERE document_id=?")) { delete.setLong(1, id); delete.executeUpdate(); }
                links(db, id, value.subject_ids);
                if (value.directions != null || value.language != null || value.module != null) {
                    var old = library.document(id);
                    @SuppressWarnings("unchecked") List<String> oldDirections = (List<String>) old.get("directions");
                    CatalogRepository.classify(db, id, value.module == null ? (String)old.get("module") : value.module, value.language == null ? (String)old.get("language") : value.language, value.directions == null ? oldDirections : value.directions);
                } else {
                    // Preserve explicit catalog classifications when using the legacy metadata API.
                    try (var insert = db.prepareStatement("INSERT OR IGNORE INTO document_directions VALUES(?,?)")) { for (String direction : directionsForSubjects(db, value.subject_ids)) { insert.setLong(1,id); insert.setString(2,direction); insert.executeUpdate(); } }
                }
                transaction.execute("COMMIT");
            } catch (SQLException | RuntimeException failure) { transaction.execute("ROLLBACK"); throw failure; }
        }
        return Map.of("status", "ok");
    }
    @GetMapping("/books")
    public Map<String, Object> books(Authentication user) throws SQLException {
        authorize(user); List<Map<String, Object>> values = new ArrayList<>();
        try (var db = library.connect(true); var query = db.createStatement(); var rows = query.executeQuery("SELECT b.*,coalesce(x.language,'en') AS language,d.name AS direction_name FROM learning_books b JOIN learning_directions d ON d.slug=b.direction LEFT JOIN learning_book_details x ON x.book_id=b.id ORDER BY d.sort_order,b.sort_order,b.id")) {
            while (rows.next()) {
                Map<String, Object> value = new LinkedHashMap<>();
                for (String field : List.of("title", "authors", "direction", "direction_name", "stage", "prerequisites", "language", "source_url")) value.put(field, rows.getString(field));
                value.put("id", rows.getLong("id")); value.put("sort_order", rows.getInt("sort_order")); value.put("document_id", rows.getObject("document_id")); values.add(value);
            }
        }
        Map<String,List<String>> courses = new LinkedHashMap<>();
        for (var book : values) { String direction = (String)book.get("direction"); courses.put(direction,LearningCourses.forDirection(direction)); }
        return Map.of("books", values, "analysis_courses", LearningCourses.ANALYSIS, "courses", courses);
    }
    public record Book(String stage, String prerequisites, Integer sort_order, Long document_id, String direction, String language, String title, String authors, String source_url) {}
    @PutMapping("/books/{id}")
    public Map<String,String> editBook(Authentication user, @PathVariable long id, @RequestBody Book value) throws SQLException {
        authorize(user); saveBook(id, value, false); return Map.of("status","ok");
    }
    @PostMapping("/books")
    public ResponseEntity<Map<String,Long>> createBook(Authentication user, @RequestBody Book value) throws SQLException {
        authorize(user); return ResponseEntity.status(201).body(Map.of("id",saveBook(0,value,true)));
    }
    private long saveBook(long id, Book value, boolean create) throws SQLException {
        if (value.stage == null || value.sort_order == null || value.sort_order < 0 || value.sort_order > 10000) throw new ApiProblem(400,"invalid_book");
        String prerequisites = text(value.prerequisites,false);
        try (var db = library.connect(false); var transaction = db.createStatement()) {
            transaction.execute("BEGIN IMMEDIATE");
            try {
                String direction = value.direction, language = value.language, title = value.title, authors = value.authors, source = value.source_url;
                if (!create) {
                    try (var query = db.prepareStatement("SELECT b.*,coalesce(x.language,'en') AS language FROM learning_books b LEFT JOIN learning_book_details x ON x.book_id=b.id WHERE b.id=?")) {
                        query.setLong(1,id); try (var row = query.executeQuery()) {
                            if (!row.next()) throw new ApiProblem(404,"not_found");
                            if (direction == null) direction = row.getString("direction"); if (language == null) language = row.getString("language");
                            if (title == null) title = row.getString("title"); if (authors == null) authors = row.getString("authors"); if (source == null) source = row.getString("source_url");
                        }
                    }
                }
                if (language == null || !Set.of("zh","en").contains(language) || direction == null || !LearningCourses.forDirection(direction).contains(value.stage)) throw new ApiProblem(400,"invalid_book");
                title = LibraryRepository.displayTitle(text(title,true)); authors = text(authors,false); source = source == null ? "" : text(source,false);
                if (!source.isEmpty()) {
                    try { var uri = java.net.URI.create(source); if (uri.getScheme() == null || !Set.of("https","http").contains(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null) throw new IllegalArgumentException(); }
                    catch (IllegalArgumentException failure) { throw new ApiProblem(400,"invalid_source"); }
                }
                try (var query = db.prepareStatement("SELECT 1 FROM learning_directions WHERE slug=?")) { query.setString(1,direction); try (var row = query.executeQuery()) { if (!row.next()) throw new ApiProblem(400,"invalid_book"); } }
                if (value.document_id != null) CatalogRepository.checkBookDocument(db,value.document_id,direction,language);
                if (create && value.document_id == null) throw new ApiProblem(400,"document_required");
                String sql = create ? "INSERT INTO learning_books(stage,prerequisites,sort_order,document_id,direction,title,authors,source_url) VALUES(?,?,?,?,?,?,?,?)" : "UPDATE learning_books SET stage=?,prerequisites=?,sort_order=?,document_id=?,direction=?,title=?,authors=?,source_url=? WHERE id=?";
                try (var update = db.prepareStatement(sql)) {
                    update.setString(1,value.stage); update.setString(2,prerequisites); update.setInt(3,value.sort_order); update.setObject(4,value.document_id); update.setString(5,direction); update.setString(6,title); update.setString(7,authors); update.setString(8,source); if (!create) update.setLong(9,id); update.executeUpdate();
                }
                if (create) { try (var row = transaction.executeQuery("SELECT last_insert_rowid()")) { row.next(); id=row.getLong(1); } }
                try (var insert = db.prepareStatement("INSERT INTO learning_book_details(book_id,language) VALUES(?,?) ON CONFLICT(book_id) DO UPDATE SET language=excluded.language")) { insert.setLong(1,id); insert.setString(2,language); insert.executeUpdate(); }
                transaction.execute("COMMIT"); return id;
            } catch (SQLException | RuntimeException failure) { transaction.execute("ROLLBACK"); throw failure; }
        }
    }
    @GetMapping("/invitations")
    public Map<String, Object> invitations(Authentication user, @RequestParam(defaultValue="0") int offset) throws SQLException {
        authorize(user); if (offset < 0) throw new ApiProblem(400, "invalid_query");
        List<Map<String, Object>> values = new ArrayList<>();
        try (var db = library.connect(true); var query = db.prepareStatement("SELECT i.*,r.revoked_at FROM invitations i LEFT JOIN invitation_revocations r ON r.code_hash=i.code_hash ORDER BY i.created_at DESC,i.rowid DESC LIMIT 20 OFFSET ?")) {
            query.setInt(1, offset);
            try (var rows = query.executeQuery()) { while (rows.next()) {
                Map<String, Object> value = new LinkedHashMap<>(); value.put("id", rows.getString("code_hash"));
                for (String field : List.of("created_at", "used_at", "used_by", "revoked_at")) value.put(field, rows.getString(field));
                value.put("expires_at", rows.getObject("expires_at"));
                String status = rows.getString("used_at") != null ? "used" : rows.getString("revoked_at") != null ? "revoked" : rows.getObject("expires_at") != null && rows.getLong("expires_at") <= System.currentTimeMillis()/1000 ? "expired" : "active";
                value.put("status", status); values.add(value);
            } }
        }
        return Map.of("invitations", values, "limit", 20, "offset", offset);
    }
    public record Invitation(Integer days) {}
    @PostMapping("/invitations")
    public ResponseEntity<Map<String, Object>> createInvitation(Authentication user, @RequestBody Invitation value) throws SQLException {
        authorize(user); if (value.days == null || value.days < 1 || value.days > 365) throw new ApiProblem(400, "invalid_expiry");
        byte[] bytes = new byte[32]; new SecureRandom().nextBytes(bytes); String code = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        long expires = System.currentTimeMillis()/1000 + value.days * 86400L;
        try (var db = library.connect(false); var insert = db.prepareStatement("INSERT INTO invitations(code_hash,expires_at) VALUES(?,?)")) {
            insert.setString(1, UserRepository.invitationHash(code)); insert.setLong(2, expires); insert.executeUpdate();
        }
        return ResponseEntity.status(201).body(Map.of("code", code, "id", UserRepository.invitationHash(code), "expires_at", expires));
    }
    @PostMapping("/invitations/{id}/revoke")
    public Map<String, String> revoke(Authentication user, @PathVariable String id) throws SQLException {
        authorize(user); if (!id.matches("[a-f0-9]{64}")) throw new ApiProblem(404, "not_found");
        try (var db = library.connect(false); var insert = db.prepareStatement("INSERT OR IGNORE INTO invitation_revocations(code_hash) SELECT code_hash FROM invitations WHERE code_hash=? AND used_at IS NULL")) {
            insert.setString(1, id); int changed = insert.executeUpdate();
            if (changed == 0) {
                try (var query = db.prepareStatement("SELECT 1 FROM invitation_revocations WHERE code_hash=?")) { query.setString(1, id); try (var row = query.executeQuery()) { if (!row.next()) throw new ApiProblem(409, "invitation_unavailable"); } }
            }
        }
        return Map.of("status", "ok");
    }
}
