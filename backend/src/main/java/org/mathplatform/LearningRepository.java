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
    LearningRepository(LibraryRepository database) { this.database = database; }
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
            try (var q = c.prepareStatement(bookQuery() + " WHERE b.direction=? ORDER BY b.sort_order")) {
                q.setString(1, user); q.setString(2, slug); try (var rows = q.executeQuery()) { while (rows.next()) books.add(bookValue(rows)); }
            }
            value.put("books", books);
        }
        return value;
    }
    private static String bookQuery() { return "SELECT b.*,p.page,p.total_pages,p.position,p.zoom FROM learning_books b LEFT JOIN learning_progress p ON p.book_id=b.id AND p.username=?"; }
    private static Map<String, Object> bookValue(ResultSet row) throws SQLException {
        var value = new LinkedHashMap<String, Object>();
        value.put("id", row.getLong("id"));
        for (String key : List.of("direction", "title", "authors", "stage", "prerequisites", "source_url")) value.put(key, row.getString(key));
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
    private static void available(Connection c, long id) throws SQLException {
        try (var s = c.prepareStatement("SELECT document_id FROM learning_books WHERE id=?")) {
            s.setLong(1, id); try (var row = s.executeQuery()) {
                if (!row.next()) throw new ApiProblem(404, "not_found");
                if (row.getLong(1) == 0) throw new ApiProblem(409, "textbook_unavailable");
            }
        }
    }
    public void progress(long id, String user, Progress p) throws SQLException {
        if (p.page < 1 || p.total_pages < p.page || p.total_pages > 100000 || !Double.isFinite(p.position) || p.position < 0 || p.position > 1 || !Double.isFinite(p.zoom) || p.zoom < .5 || p.zoom > 2.5) throw new ApiProblem(400, "invalid_progress");
        try (var c = database.connect(false)) {
            available(c, id);
            try (var s = c.prepareStatement("INSERT INTO learning_progress(username,book_id,page,total_pages,position,zoom) VALUES(?,?,?,?,?,?) ON CONFLICT(username,book_id) DO UPDATE SET page=excluded.page,total_pages=excluded.total_pages,position=excluded.position,zoom=excluded.zoom,updated_at=strftime('%Y-%m-%dT%H:%M:%SZ','now')")) {
                s.setString(1, user); s.setLong(2, id); s.setInt(3, p.page); s.setInt(4, p.total_pages); s.setDouble(5, p.position); s.setDouble(6, p.zoom); s.executeUpdate();
            }
        }
    }
    public List<Map<String, Object>> marks(long book, String user) throws SQLException {
        var values = new ArrayList<Map<String, Object>>();
        try (var c = database.connect(true)) {
            available(c, book);
            try (var s = c.prepareStatement("SELECT * FROM learning_marks WHERE username=? AND book_id=? ORDER BY page,id")) {
                s.setString(1, user); s.setLong(2, book);
                try (var rows = s.executeQuery()) {
                    while (rows.next()) {
                        var value = new LinkedHashMap<String, Object>(); long id = rows.getLong("id"); value.put("id", id); value.put("page", rows.getInt("page"));
                        for (String key : List.of("quote", "note", "color")) value.put(key, rows.getString(key));
                        var rects = new ArrayList<Rect>();
                        try (var q = c.prepareStatement("SELECT x,y,width,height FROM learning_mark_rects WHERE mark_id=? ORDER BY position")) {
                            q.setLong(1, id); try (var rr = q.executeQuery()) { while (rr.next()) rects.add(new Rect(rr.getDouble(1), rr.getDouble(2), rr.getDouble(3), rr.getDouble(4))); }
                        }
                        value.put("rects", rects); values.add(value);
                    }
                }
            }
        }
        return values;
    }
    private static boolean text(String value, int limit) { return value != null && value.length() <= limit && value.indexOf('\0') < 0; }
    public long createMark(long book, String user, Mark mark) throws SQLException {
        if (mark.page < 1 || mark.page > 100000 || !text(mark.quote, 4000) || mark.quote.isBlank() || !text(mark.note, 4000) || !List.of("yellow", "blue", "pink").contains(mark.color == null ? "" : mark.color) || mark.rects == null || mark.rects.isEmpty() || mark.rects.size() > 100) throw new ApiProblem(400, "invalid_annotation");
        for (var r : mark.rects) if (r == null || !Double.isFinite(r.x + r.y + r.width + r.height) || r.x < 0 || r.y < 0 || r.width <= 0 || r.height <= 0 || r.x + r.width > 1.00001 || r.y + r.height > 1.00001) throw new ApiProblem(400, "invalid_annotation");
        try (var c = database.connect(false); var tx = c.createStatement()) {
            tx.execute("BEGIN IMMEDIATE");
            try {
                available(c, book);
                try (var s = c.prepareStatement("SELECT COUNT(*) FROM learning_marks WHERE username=? AND book_id=?")) {
                    s.setString(1, user); s.setLong(2, book); try (var row = s.executeQuery()) { if (row.next() && row.getInt(1) >= 1000) throw new ApiProblem(400, "annotation_limit"); }
                }
                try (var s = c.prepareStatement("INSERT INTO learning_marks(username,book_id,page,quote,note,color) VALUES(?,?,?,?,?,?)")) {
                    s.setString(1, user); s.setLong(2, book); s.setInt(3, mark.page); s.setString(4, mark.quote); s.setString(5, mark.note); s.setString(6, mark.color); s.executeUpdate();
                }
                long id; try (var row = tx.executeQuery("SELECT last_insert_rowid()")) { row.next(); id = row.getLong(1); }
                try (var s = c.prepareStatement("INSERT INTO learning_mark_rects VALUES(?,?,?,?,?,?)")) {
                    int position = 0; for (var r : mark.rects) { s.setLong(1, id); s.setInt(2, position++); s.setDouble(3, r.x); s.setDouble(4, r.y); s.setDouble(5, r.width); s.setDouble(6, r.height); s.executeUpdate(); }
                }
                tx.execute("COMMIT"); return id;
            } catch (SQLException | RuntimeException failure) { tx.execute("ROLLBACK"); throw failure; }
        }
    }
    public void editMark(long book, long mark, String user, Note note) throws SQLException {
        if (!text(note.note, 4000)) throw new ApiProblem(400, "invalid_annotation");
        try (var c = database.connect(false); var s = c.prepareStatement("UPDATE learning_marks SET note=? WHERE id=? AND book_id=? AND username=?")) {
            s.setString(1, note.note); s.setLong(2, mark); s.setLong(3, book); s.setString(4, user); if (s.executeUpdate() != 1) throw new ApiProblem(404, "not_found");
        }
    }
    public void deleteMark(long book, long mark, String user) throws SQLException {
        try (var c = database.connect(false); var s = c.prepareStatement("DELETE FROM learning_marks WHERE id=? AND book_id=? AND username=?")) {
            s.setLong(1, mark); s.setLong(2, book); s.setString(3, user); if (s.executeUpdate() != 1) throw new ApiProblem(404, "not_found");
        }
    }
}
