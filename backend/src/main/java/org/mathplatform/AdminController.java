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
    AdminController(LibraryRepository library, UserRepository users) { this.library = library; this.users = users; }
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
    public Map<String, Object> documents(Authentication user, @RequestParam(defaultValue="0") int offset, @RequestParam(defaultValue="") String q) throws SQLException {
        authorize(user);
        if (offset < 0 || q.length() > 200) throw new ApiProblem(400, "invalid_query");
        List<Map<String, Object>> values = new ArrayList<>();
        try (var db = library.connect(true); var query = db.prepareStatement("SELECT id FROM documents WHERE instr(lower(title),lower(?))>0 OR instr(lower(authors),lower(?))>0 ORDER BY id DESC LIMIT 20 OFFSET ?")) {
            query.setString(1, q); query.setString(2, q); query.setInt(3, offset);
            try (var result = query.executeQuery()) { while (result.next()) values.add(library.document(result.getLong(1))); }
        }
        return Map.of("documents", values, "offset", offset, "limit", 20);
    }
    @PostMapping("/documents")
    public ResponseEntity<Map<String, Object>> upload(Authentication user, HttpServletRequest request,
            @RequestParam String title, @RequestParam(defaultValue="") String authors, @RequestParam long subject_id) throws SQLException, IOException {
        authorize(user); title = text(title, true); authors = text(authors, false);
        if (!"application/pdf".equalsIgnoreCase(request.getContentType())) throw new ApiProblem(400, "invalid_pdf");
        int limit = 20 * 1024 * 1024;
        if (request.getContentLengthLong() > limit) throw new ApiProblem(413, "request_too_large");
        byte[] bytes = request.getInputStream().readNBytes(limit + 1);
        if (bytes.length > limit) throw new ApiProblem(413, "request_too_large");
        if (bytes.length < 5 || !new String(bytes, 0, 5, StandardCharsets.US_ASCII).equals("%PDF-")) throw new ApiProblem(400, "invalid_pdf");
        Path saved = null; boolean committed = false;
        try (var db = library.connect(false); var transaction = db.createStatement()) {
            transaction.execute("BEGIN IMMEDIATE");
            try {
                subjects(db, List.of(subject_id));
                try { saved = Files.createTempFile(Path.of("data/files"), "upload-", "", PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rw-------"))); }
                catch (UnsupportedOperationException failure) { saved = Files.createTempFile(Path.of("data/files"), "upload-", ""); }
                try (var output = java.nio.channels.FileChannel.open(saved, java.nio.file.StandardOpenOption.WRITE)) {
                    var buffer = java.nio.ByteBuffer.wrap(bytes); while (buffer.hasRemaining()) output.write(buffer); output.force(true);
                }
                try (var insert = db.prepareStatement("INSERT INTO documents(title,authors,file_path,file_size) VALUES(?,?,?,?)")) {
                    insert.setString(1, title); insert.setString(2, authors); insert.setString(3, "data/files/" + saved.getFileName()); insert.setInt(4, bytes.length); insert.executeUpdate();
                }
                long id;
                try (var result = transaction.executeQuery("SELECT last_insert_rowid()")) { result.next(); id = result.getLong(1); }
                links(db, id, List.of(subject_id)); transaction.execute("COMMIT"); committed = true;
                return ResponseEntity.status(201).body(Map.of("id", id, "file_url", "/api/documents/" + id + "/file"));
            } catch (SQLException | IOException | RuntimeException failure) { transaction.execute("ROLLBACK"); throw failure; }
        } finally { if (!committed && saved != null) Files.deleteIfExists(saved); }
    }
    public record Metadata(String title, String authors, List<Long> subject_ids) {}
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
                links(db, id, value.subject_ids); transaction.execute("COMMIT");
            } catch (SQLException | RuntimeException failure) { transaction.execute("ROLLBACK"); throw failure; }
        }
        return Map.of("status", "ok");
    }
    @GetMapping("/books")
    public Map<String, Object> books(Authentication user) throws SQLException {
        authorize(user); List<Map<String, Object>> values = new ArrayList<>();
        try (var db = library.connect(true); var query = db.createStatement(); var rows = query.executeQuery("SELECT b.*,d.name AS direction_name FROM learning_books b JOIN learning_directions d ON d.slug=b.direction ORDER BY d.sort_order,b.sort_order,b.id")) {
            while (rows.next()) {
                Map<String, Object> value = new LinkedHashMap<>();
                for (String field : List.of("title", "authors", "direction", "direction_name", "stage", "prerequisites")) value.put(field, rows.getString(field));
                value.put("id", rows.getLong("id")); value.put("sort_order", rows.getInt("sort_order")); value.put("document_id", rows.getObject("document_id")); values.add(value);
            }
        }
        return Map.of("books", values);
    }
    public record Book(String stage, String prerequisites, Integer sort_order, Long document_id) {}
    @PutMapping("/books/{id}")
    public Map<String, String> editBook(Authentication user, @PathVariable long id, @RequestBody Book value) throws SQLException {
        authorize(user);
        if (value.stage == null || !Set.of("基础入门", "核心理论", "进阶学习").contains(value.stage) || value.sort_order == null || value.sort_order < 0 || value.sort_order > 10000) throw new ApiProblem(400, "invalid_book");
        String prerequisites = text(value.prerequisites, false);
        try (var db = library.connect(false); var transaction = db.createStatement()) {
            transaction.execute("BEGIN IMMEDIATE");
            try {
                try (var query = db.prepareStatement("SELECT document_id FROM learning_books WHERE id=?")) {
                    query.setLong(1, id);
                    try (var row = query.executeQuery()) {
                        if (!row.next()) throw new ApiProblem(404, "not_found");
                        Long old = row.getObject(1) == null ? null : row.getLong(1);
                        if (old != null && !old.equals(value.document_id)) throw new ApiProblem(409, "book_document_locked");
                    }
                }
                if (value.document_id != null) library.document(value.document_id);
                try (var update = db.prepareStatement("UPDATE learning_books SET stage=?,prerequisites=?,sort_order=?,document_id=? WHERE id=?")) {
                    update.setString(1, value.stage); update.setString(2, prerequisites); update.setInt(3, value.sort_order); update.setObject(4, value.document_id); update.setLong(5, id); update.executeUpdate();
                }
                transaction.execute("COMMIT");
            } catch (SQLException | RuntimeException failure) { transaction.execute("ROLLBACK"); throw failure; }
        }
        return Map.of("status", "ok");
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
