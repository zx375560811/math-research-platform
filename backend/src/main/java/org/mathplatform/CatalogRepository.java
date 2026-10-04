package org.mathplatform;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Repository;

@Repository
public class CatalogRepository {
    private final LibraryRepository library;
    private final LearningRepository learning;
    CatalogRepository(LibraryRepository library, LearningRepository learning) { this.library = library; this.learning = learning; }
    public Map<String, Object> categories() throws SQLException {
        return Map.of("modules", List.of(Map.of("slug", "mathematics", "name", "数学与应用数学", "directions", learning.directions())));
    }
    public Map<String, Object> documents(String module, String direction, String language, String q, int offset, String user) throws SQLException {
        return documents(module,direction,language,q,offset,user,"");
    }
    public Map<String,Object> documents(String module,String direction,String language,String q,int offset,String user,String collection) throws SQLException {
        long collectionId=0;
        if(!collection.isEmpty() && !collection.equals("unfiled")) {
            try { if(!collection.matches("[1-9][0-9]*"))throw new NumberFormatException();collectionId=Long.parseLong(collection); }
            catch(NumberFormatException failure){throw new ApiProblem(400,"invalid_query");}
            try(var db=library.connect(true);var query=db.prepareStatement("SELECT 1 FROM library_collections WHERE id=?")){query.setLong(1,collectionId);try(var row=query.executeQuery()){if(!row.next())throw new ApiProblem(404,"not_found");}}
        }
        if (!module.isEmpty() && !module.equals("mathematics") || !Set.of("", "zh", "en", "und").contains(language) || offset < 0 || q.length() > 200) throw new ApiProblem(400, "invalid_query");
        if (!direction.isEmpty() && !direction.equals("unclassified")) {
            try (var db = library.connect(true); var query = db.prepareStatement("SELECT 1 FROM learning_directions WHERE slug=?")) { query.setString(1, direction); try (var row = query.executeQuery()) { if (!row.next()) throw new ApiProblem(400, "invalid_query"); } }
        }
        List<Map<String, Object>> values = new ArrayList<>();
        String prefix=collectionId>0?"WITH RECURSIVE folders(id) AS (SELECT id FROM library_collections WHERE id=? UNION SELECT c.id FROM library_collections c JOIN folders f ON c.parent_id=f.id) ":"";
        String folderFilter=collectionId>0?" AND EXISTS(SELECT 1 FROM document_collections x JOIN folders f ON f.id=x.collection_id WHERE x.document_id=d.id) ":collection.equals("unfiled")?" AND NOT EXISTS(SELECT 1 FROM document_collections x WHERE x.document_id=d.id) ":"";
        String sql = prefix + "SELECT d.id,p.page,p.total_pages,p.position,p.zoom FROM documents d LEFT JOIN document_catalog c ON c.document_id=d.id LEFT JOIN document_progress p ON p.document_id=d.id AND p.username=? "
            + "WHERE (?='' OR coalesce(c.module,'mathematics')=?) AND (?='' OR coalesce(c.language,'und')=?) "
            + "AND (?='' OR (?='unclassified' AND NOT EXISTS(SELECT 1 FROM document_directions x WHERE x.document_id=d.id)) OR EXISTS(SELECT 1 FROM document_directions x WHERE x.document_id=d.id AND x.direction=?)) "
            + "AND (instr(lower(d.title),lower(?))>0 OR instr(lower(d.authors),lower(?))>0)" + folderFilter + " ORDER BY d.id DESC LIMIT 20 OFFSET ?";
        try (var db = library.connect(true); var query = db.prepareStatement(sql)) {
            int bind=1;if(collectionId>0)query.setLong(bind++,collectionId);
            query.setString(bind++, user); query.setString(bind++, module); query.setString(bind++, module); query.setString(bind++, language); query.setString(bind++, language);
            query.setString(bind++, direction); query.setString(bind++, direction); query.setString(bind++, direction); query.setString(bind++, q); query.setString(bind++, q); query.setInt(bind, offset);
            try (var rows = query.executeQuery()) { while (rows.next()) {
                var value = library.document(rows.getLong("id"));
                value.put("progress", rows.getInt("page") == 0 ? null : Map.of("page", rows.getInt("page"), "total_pages", rows.getInt("total_pages"), "position", rows.getDouble("position"), "zoom", rows.getDouble("zoom")));
                values.add(value);
            } }
        }
        return Map.of("documents", values, "limit", 20, "offset", offset);
    }
    static void classify(Connection db, long id, String module, String language, List<String> directions) throws SQLException {
        if (!"mathematics".equals(module) || language == null || !Set.of("zh", "en", "und").contains(language) || directions == null || directions.size() > 8 || directions.stream().anyMatch(java.util.Objects::isNull) || Set.copyOf(directions).size() != directions.size()) throw new ApiProblem(400, "invalid_classification");
        try (var query = db.prepareStatement("SELECT 1 FROM learning_directions WHERE slug=?")) { for (String direction : directions) { query.setString(1, direction); try (var row = query.executeQuery()) { if (!row.next()) throw new ApiProblem(400, "invalid_classification"); } } }
        // A bound textbook must remain discoverable in its direction and language.
        try (var query = db.prepareStatement("SELECT b.direction,coalesce(x.language,'en') FROM learning_books b LEFT JOIN learning_book_details x ON x.book_id=b.id WHERE b.document_id=?")) {
            query.setLong(1, id); try (var rows = query.executeQuery()) { while (rows.next()) if (!directions.contains(rows.getString(1)) || (!language.equals("und") && !language.equals(rows.getString(2)))) throw new ApiProblem(409, "classification_in_use"); }
        }
        try (var insert = db.prepareStatement("INSERT INTO document_catalog(document_id,module,language) VALUES(?,?,?) ON CONFLICT(document_id) DO UPDATE SET module=excluded.module,language=excluded.language")) { insert.setLong(1, id); insert.setString(2, module); insert.setString(3, language); insert.executeUpdate(); }
        try (var delete = db.prepareStatement("DELETE FROM document_directions WHERE document_id=?")) { delete.setLong(1, id); delete.executeUpdate(); }
        try (var insert = db.prepareStatement("INSERT INTO document_directions VALUES(?,?)")) { for (String direction : directions) { insert.setLong(1, id); insert.setString(2, direction); insert.executeUpdate(); } }
    }
    static void checkBookDocument(Connection db, long document, String direction, String language) throws SQLException {
        try (var query = db.prepareStatement("SELECT coalesce(c.language,'und'),EXISTS(SELECT 1 FROM document_directions x WHERE x.document_id=d.id AND x.direction=?) FROM documents d LEFT JOIN document_catalog c ON c.document_id=d.id WHERE d.id=?")) {
            query.setString(1, direction); query.setLong(2, document); try (var row = query.executeQuery()) {
                if (!row.next()) throw new ApiProblem(404, "not_found");
                if (!row.getBoolean(2) || (!row.getString(1).equals("und") && !row.getString(1).equals(language))) throw new ApiProblem(400, "document_direction_mismatch");
            }
        }
    }
}
