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
        try (var c = database.connect(true); var s = c.createStatement(); var rows = s.executeQuery("SELECT * FROM learning_directions ORDER BY sort_order")) {
            while (rows.next()) values.add(Map.of("slug", rows.getString("slug"), "name", rows.getString("name"), "description", rows.getString("description"), "featured", rows.getBoolean("featured")));
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
            var questions = new ArrayList<String>();
            try (var q = c.prepareStatement("SELECT question FROM learning_questions WHERE direction=? ORDER BY position")) {
                q.setString(1, slug); try (var rows = q.executeQuery()) { while (rows.next()) questions.add(rows.getString(1)); }
            }
            value.put("questions", questions);
            var books = new ArrayList<Map<String, Object>>();
            try (var q = c.prepareStatement(bookQuery() + " WHERE b.direction=? ORDER BY b.sort_order,b.id")) {
                q.setString(1, user); q.setString(2, slug); try (var rows = q.executeQuery()) { while (rows.next()) books.add(bookValue(rows)); }
            }
            value.put("books", books);
        }
        return value;
    }
    private static String bookQuery() { return "SELECT b.*,coalesce(x.language,'en') AS language,p.page,p.total_pages,p.position,p.zoom FROM learning_books b LEFT JOIN learning_book_details x ON x.book_id=b.id LEFT JOIN document_progress p ON p.document_id=b.document_id AND p.username=?"; }
    private static Map<String, Object> bookValue(ResultSet row) throws SQLException {
        var value = new LinkedHashMap<String, Object>();
        value.put("id", row.getLong("id"));
        for (String key : List.of("direction", "title", "authors", "stage", "prerequisites", "source_url", "language")) value.put(key, row.getString(key));
        long document = row.getLong("document_id"); value.put("available", document != 0);
        value.put("file_url", document == 0 ? null : "/api/documents/" + document + "/file");
        int page = row.getInt("page");
        value.put("progress", page == 0 ? null : Map.of("page", page, "total_pages", row.getInt("total_pages"), "position", row.getDouble("position"), "zoom", row.getDouble("zoom")));
        return value;
    }
    public Map<String, Object> book(long id, String user) throws SQLException {
        try (var c = database.connect(true); var s = c.prepareStatement(bookQuery() + " WHERE b.id=?")) {
            s.setString(1, user); s.setLong(2, id); try (var row = s.executeQuery()) { if (!row.next()) throw new ApiProblem(404, "not_found"); return bookValue(row); }
        }
    }
    private long document(long book) throws SQLException {
        try (var db = database.connect(true); var query = db.prepareStatement("SELECT document_id FROM learning_books WHERE id=?")) {
            query.setLong(1, book); try (var row = query.executeQuery()) {
                if (!row.next()) throw new ApiProblem(404, "not_found");
                long document = row.getLong(1); if (document == 0) throw new ApiProblem(409, "textbook_unavailable"); return document;
            }
        }
    }
    public void progress(long book, String user, Progress value) throws SQLException { reading.progress(document(book), user, value); }
    public List<Map<String,Object>> marks(long book, String user) throws SQLException { return reading.marks(document(book), user); }
    public long createMark(long book, String user, Mark value) throws SQLException { return reading.createMark(document(book), user, value); }
    public void editMark(long book, long mark, String user, Note value) throws SQLException { reading.editMark(document(book), mark, user, value); }
    public void deleteMark(long book, long mark, String user) throws SQLException { reading.deleteMark(document(book), mark, user); }
}
