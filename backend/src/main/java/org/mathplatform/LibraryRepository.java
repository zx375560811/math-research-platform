package org.mathplatform;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Repository;

@Repository
public class LibraryRepository {
    private final String url;
    static String setting(String name, String fallback) {
        String value = System.getenv(name);
        return value == null || value.isBlank() ? fallback : value;
    }

    LibraryRepository() throws IOException, SQLException {
        Files.createDirectories(Path.of("data/files"));
        Path database = Path.of(setting("MATH_DB_PATH", "data/math.db")).toAbsolutePath().normalize();
        url = "jdbc:sqlite:" + database;
        String schema;
        try (var resource = getClass().getResourceAsStream("/schema.sql")) {
            if (resource == null) throw new IOException("Missing schema.sql");
            schema = new String(resource.readAllBytes(), StandardCharsets.UTF_8);
        }
        // Library requests are query-only; account operations use separate write transactions.
        try (Connection connection = connect(false); var statement = connection.createStatement()) {
            for (String sql : schema.split(";")) if (!sql.isBlank()) statement.execute(sql);
            try (var catalog = getClass().getResourceAsStream("/learning.sql")) {
                if (catalog == null) throw new IOException("Missing learning.sql");
                for (String sql : new String(catalog.readAllBytes(), StandardCharsets.UTF_8).split(";")) if (!sql.isBlank()) statement.execute(sql);
            }
            // One-time transition requested by the owner: discard open-registration accounts.
            statement.execute("BEGIN IMMEDIATE");
            try {
                int applied = statement.executeUpdate("INSERT OR IGNORE INTO account_migrations(name) VALUES('invite_only_v1')");
                if (applied == 1) statement.executeUpdate("DELETE FROM users");
                statement.execute("COMMIT");
            } catch (SQLException failure) { statement.execute("ROLLBACK"); throw failure; }
            statement.execute("INSERT OR IGNORE INTO document_catalog(document_id) SELECT id FROM documents");
            statement.execute("BEGIN IMMEDIATE");
            try {
                if (statement.executeUpdate("INSERT OR IGNORE INTO account_migrations(name) VALUES('library_catalog_v1')") == 1) {
                    statement.execute("INSERT OR IGNORE INTO document_directions SELECT ds.document_id,d.slug FROM document_subjects ds JOIN subjects s ON s.id=ds.subject_id JOIN learning_directions d ON d.slug=s.slug");
                    statement.execute("INSERT OR IGNORE INTO document_directions SELECT document_id,direction FROM learning_books WHERE document_id IS NOT NULL");
                    statement.execute("UPDATE document_catalog SET language='en' WHERE document_id IN(SELECT document_id FROM learning_books WHERE document_id IS NOT NULL)");
                }
                if (statement.executeUpdate("INSERT OR IGNORE INTO account_migrations(name) VALUES('document_reading_v1')") == 1) {
                    // If multiple old textbook entries share a PDF, retain the most recent position.
                    statement.execute("INSERT OR REPLACE INTO document_progress SELECT p.username,b.document_id,p.page,p.total_pages,p.position,p.zoom,p.updated_at FROM learning_progress p JOIN learning_books b ON b.id=p.book_id WHERE b.document_id IS NOT NULL ORDER BY p.updated_at,p.book_id");
                    statement.execute("INSERT INTO document_marks(id,username,document_id,page,quote,note,color,created_at) SELECT m.id,m.username,b.document_id,m.page,m.quote,m.note,m.color,m.created_at FROM learning_marks m JOIN learning_books b ON b.id=m.book_id WHERE b.document_id IS NOT NULL");
                    statement.execute("INSERT INTO document_mark_rects SELECT r.* FROM learning_mark_rects r JOIN document_marks m ON m.id=r.mark_id");
                }
                if (statement.executeUpdate("INSERT OR IGNORE INTO account_migrations(name) VALUES('analysis_courses_v1')") == 1) {
                    try (var courses = getClass().getResourceAsStream("/learning-courses.sql")) {
                        if (courses == null) throw new IOException("Missing learning-courses.sql");
                        for (String sql : new String(courses.readAllBytes(), StandardCharsets.UTF_8).split(";")) if (!sql.isBlank()) statement.execute(sql);
                    }
                }
                statement.execute("COMMIT");
            } catch (SQLException | IOException failure) { statement.execute("ROLLBACK"); throw failure; }
        }
    }

    Connection connect(boolean readOnly) throws SQLException {
        Connection connection = DriverManager.getConnection(url);
        try (var statement = connection.createStatement()) {
            statement.execute("PRAGMA busy_timeout=3000");
            statement.execute("PRAGMA foreign_keys=ON");
            if (readOnly) statement.execute("PRAGMA query_only=ON");
        } catch (SQLException failure) { connection.close(); throw failure; }
        return connection;
    }

    public void health() throws SQLException {
        try (Connection connection = connect(true); var statement = connection.createStatement();
             var result = statement.executeQuery("SELECT 1 FROM subjects LIMIT 1")) { result.next(); }
    }

    public List<Map<String, Object>> subjects() throws SQLException {
        List<Map<String, Object>> values = new ArrayList<>();
        try (Connection connection = connect(true); var statement = connection.createStatement();
             var result = statement.executeQuery("SELECT id,slug,name FROM subjects ORDER BY id")) {
            while (result.next()) values.add(Map.of("id", result.getLong("id"), "slug", result.getString("slug"), "name", result.getString("name")));
        }
        return values;
    }

    private Map<String, Object> document(Connection connection, ResultSet result) throws SQLException {
        long id = result.getLong("id");
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("id", id); value.put("title", result.getString("title")); value.put("authors", result.getString("authors"));
        value.put("file_size", result.getLong("file_size")); value.put("created_at", result.getString("created_at"));
        value.put("file_url", "/api/documents/" + id + "/file");
        List<Long> subjects = new ArrayList<>();
        try (var links = connection.prepareStatement("SELECT subject_id FROM document_subjects WHERE document_id=? ORDER BY subject_id")) {
            links.setLong(1, id);
            try (var rows = links.executeQuery()) { while (rows.next()) subjects.add(rows.getLong(1)); }
        }
        value.put("subject_ids", subjects);
        try (var query = connection.prepareStatement("SELECT module,language FROM document_catalog WHERE document_id=?")) {
            query.setLong(1, id); try (var row = query.executeQuery()) { boolean found = row.next(); value.put("module", found ? row.getString(1) : "mathematics"); value.put("language", found ? row.getString(2) : "und"); }
        }
        List<String> directions = new ArrayList<>();
        try (var query = connection.prepareStatement("SELECT direction FROM document_directions WHERE document_id=? ORDER BY direction")) {
            query.setLong(1, id); try (var rows = query.executeQuery()) { while (rows.next()) directions.add(rows.getString(1)); }
        }
        value.put("directions", directions);
        return value;
    }

    public List<Map<String, Object>> documents(long subject, long offset) throws SQLException {
        List<Map<String, Object>> values = new ArrayList<>();
        String sql = "SELECT id,title,authors,file_size,created_at FROM documents WHERE (?=0 OR EXISTS "
            + "(SELECT 1 FROM document_subjects WHERE document_id=documents.id AND subject_id=?)) ORDER BY id DESC LIMIT 20 OFFSET ?";
        try (Connection connection = connect(true); PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setLong(1, subject); statement.setLong(2, subject); statement.setLong(3, offset);
            try (var result = statement.executeQuery()) { while (result.next()) values.add(document(connection, result)); }
        }
        return values;
    }

    public Map<String, Object> document(long id) throws SQLException {
        try (Connection connection = connect(true); var statement = connection.prepareStatement("SELECT id,title,authors,file_size,created_at FROM documents WHERE id=?")) {
            statement.setLong(1, id);
            try (var result = statement.executeQuery()) {
                if (!result.next()) throw new ApiProblem(404, "not_found");
                return document(connection, result);
            }
        }
    }

    public Path file(long id) throws SQLException {
        try (Connection connection = connect(true); var statement = connection.prepareStatement("SELECT file_path FROM documents WHERE id=?")) {
            statement.setLong(1, id);
            try (var result = statement.executeQuery()) {
                if (!result.next()) throw new ApiProblem(404, "not_found");
                String stored = result.getString(1);
                if (stored == null || !stored.matches("data/files/upload-[A-Za-z0-9_-]+")) throw new ApiProblem(500, "file_unavailable");
                return Path.of(stored);
            }
        }
    }
}
