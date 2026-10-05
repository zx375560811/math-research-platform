package org.mathplatform;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Repository;

@Repository
public class LearningRepository {
    private final LibraryRepository database;
    private final DocumentReadingRepository reading;
    LearningRepository(LibraryRepository database, DocumentReadingRepository reading) { this.database = database; this.reading = reading; }
    public record Progress(int page, int total_pages, double position, double zoom) {}
    public record Rect(double x, double y, double width, double height) {}
    public record Mark(int page, String quote, String note, String color, List<Rect> rects) {}
    public record Note(String note) {}

    public List<Map<String, Object>> directions() throws SQLException {
        var values = new ArrayList<Map<String, Object>>();
        String sql = "SELECT r.*,(SELECT COUNT(*) FROM documents d WHERE "
            + "EXISTS(SELECT 1 FROM document_directions x WHERE x.document_id=d.id AND x.direction=r.slug) "
            + "OR EXISTS(SELECT 1 FROM learning_books b WHERE b.document_id=d.id AND b.direction=r.slug)) AS document_count "
            + "FROM learning_directions r ORDER BY r.sort_order";
        try (var c = database.connect(true); var s = c.createStatement(); var rows = s.executeQuery(sql)) {
            while (rows.next()) values.add(Map.of("slug", rows.getString("slug"), "name", rows.getString("name"), "description", rows.getString("description"), "featured", rows.getBoolean("featured"), "document_count", rows.getLong("document_count")));
        }
        return values;
    }
    public Map<String, Object> direction(String slug, String user) throws SQLException {
        var value = new LinkedHashMap<String, Object>();
        try (var c = database.connect(true); var s = c.prepareStatement("SELECT * FROM learning_directions WHERE slug=?")) {
            s.setString(1, slug);
            try (var row = s.executeQuery()) {
                if (!row.next()) throw new ApiProblem(404, "not_found");
                value.put("slug", slug); value.put("name", row.getString("name")); value.put("description", row.getString("description"));
            }
            var introduction = new LinkedHashMap<String,Object>();
            try (var q = c.prepareStatement("SELECT research_object,core_content,prerequisites FROM learning_direction_introductions WHERE direction=?")) {
                q.setString(1,slug); try (var row = q.executeQuery()) {
                    if (row.next()) for (String field : List.of("research_object","core_content","prerequisites")) introduction.put(field,row.getString(field));
                }
            }
            value.put("introduction",introduction);
            var books = new ArrayList<Map<String, Object>>();
            try (var q = c.prepareStatement(bookQuery() + " WHERE b.direction=? ORDER BY b.sort_order,b.id")) {
                q.setString(1, user); q.setString(2, user); q.setString(3, slug); try (var rows = q.executeQuery()) { while (rows.next()) books.add(bookValue(rows)); }
            }
            value.put("books", books); value.put("courses", LearningCourses.forDirection(slug));
        }
        return value;
    }
    private static String bookQuery() { return "SELECT b.*,coalesce(x.language,'en') AS language,s.document_id AS selected_document_id,d.title AS selected_title,d.authors AS selected_authors,coalesce(s.document_id,b.document_id) AS effective_document_id,p.page,p.total_pages,p.position,p.zoom FROM learning_books b LEFT JOIN learning_book_details x ON x.book_id=b.id LEFT JOIN learning_selections s ON s.book_id=b.id AND s.username=? LEFT JOIN documents d ON d.id=s.document_id LEFT JOIN document_progress p ON p.document_id=coalesce(s.document_id,b.document_id) AND p.username=?"; }
    private Map<String, Object> bookValue(ResultSet row) throws SQLException {
        var value = new LinkedHashMap<String, Object>();
        value.put("id", row.getLong("id"));
        for (String key : List.of("direction", "title", "authors", "stage", "prerequisites", "source_url", "language")) value.put(key, row.getString(key));
        long selected = row.getLong("selected_document_id"); value.put("selected_document_id", selected == 0 ? null : selected);
        if (selected != 0) { value.put("title", LibraryRepository.displayTitle(row.getString("selected_title"))); value.put("authors", row.getString("selected_authors")); value.put("source_url", ""); }
        long document = row.getLong("effective_document_id"); value.put("available", document != 0);
        value.put("file_url", document == 0 ? null : "/api/documents/" + document + "/file");
        value.put("format", document == 0 ? "pdf" : database.format(document));
        int page = row.getInt("page");
        value.put("progress", page == 0 ? null : Map.of("page", page, "total_pages", row.getInt("total_pages"), "position", row.getDouble("position"), "zoom", row.getDouble("zoom")));
        return value;
    }
    public Map<String, Object> book(long id, String user) throws SQLException {
        try (var c = database.connect(true); var s = c.prepareStatement(bookQuery() + " WHERE b.id=?")) {
            s.setString(1, user); s.setString(2, user); s.setLong(3, id); try (var row = s.executeQuery()) { if (!row.next()) throw new ApiProblem(404, "not_found"); return bookValue(row); }
        }
    }
    private long document(long book, String user) throws SQLException {
        try (var db = database.connect(true); var query = db.prepareStatement("SELECT coalesce(s.document_id,b.document_id) FROM learning_books b LEFT JOIN learning_selections s ON s.book_id=b.id AND s.username=? WHERE b.id=?")) {
            query.setString(1, user); query.setLong(2, book); try (var row = query.executeQuery()) {
                if (!row.next()) throw new ApiProblem(404, "not_found");
                long document = row.getLong(1); if (document == 0) throw new ApiProblem(409, "textbook_unavailable"); return document;
            }
        }
    }
    public void select(long book, String user, Long document) throws SQLException {
        try (var db = database.connect(false); var tx = db.createStatement()) {
            tx.execute("BEGIN IMMEDIATE");
            try {
                try (var query = db.prepareStatement("SELECT b.direction,coalesce(x.language,'en') FROM learning_books b LEFT JOIN learning_book_details x ON x.book_id=b.id WHERE b.id=?")) {
                    query.setLong(1,book); try (var row = query.executeQuery()) {
                        if (!row.next()) throw new ApiProblem(404,"not_found");
                        if (document != null) CatalogRepository.checkBookDocument(db,document,row.getString(1),row.getString(2));
                    }
                }
                String sql = document == null ? "DELETE FROM learning_selections WHERE username=? AND book_id=?" : "INSERT INTO learning_selections(username,book_id,document_id) VALUES(?,?,?) ON CONFLICT(username,book_id) DO UPDATE SET document_id=excluded.document_id";
                try (var update = db.prepareStatement(sql)) { update.setString(1,user); update.setLong(2,book); if (document != null) update.setLong(3,document); update.executeUpdate(); }
                tx.execute("COMMIT");
            } catch (SQLException | RuntimeException failure) { tx.execute("ROLLBACK"); throw failure; }
        }
    }
    public void progress(long book, String user, Progress value) throws SQLException { reading.progress(document(book, user), user, value); }
    public List<Map<String,Object>> marks(long book, String user) throws SQLException { return reading.marks(document(book, user), user); }
    public long createMark(long book, String user, Mark value) throws SQLException { return reading.createMark(document(book, user), user, value); }
    public void editMark(long book, long mark, String user, Note value) throws SQLException { reading.editMark(document(book, user), mark, user, value); }
    public void deleteMark(long book, long mark, String user) throws SQLException { reading.deleteMark(document(book, user), mark, user); }
}
