package org.mathplatform;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.ObjectMapper;

@Repository
public class CollectionRepository {
    private final LibraryRepository library;
    CollectionRepository(LibraryRepository library) { this.library = library; }
    private static long folder(Connection db, String source, List<String> path, Long parent, String name, int order) throws SQLException {
        String key = new ObjectMapper().writeValueAsString(path);
        try (var insert = db.prepareStatement("INSERT OR IGNORE INTO library_collections(source,path_key,parent_id,name,sort_order) VALUES(?,?,?,?,?)")) {
            insert.setString(1,source); insert.setString(2,key); if(parent == null) insert.setNull(3,java.sql.Types.INTEGER); else insert.setLong(3,parent);
            insert.setString(4,name); insert.setInt(5,order); insert.executeUpdate();
        }
        try (var q=db.prepareStatement("SELECT id FROM library_collections WHERE source=? AND path_key=?")) { q.setString(1,source);q.setString(2,key);try(var r=q.executeQuery()){r.next();return r.getLong(1);} }
    }
    /** Recover directories already retained by previous imports; never read or copy original files. */
    static void backfill(Connection db) throws SQLException {
        try(var s=db.createStatement();var r=s.executeQuery("SELECT 1 FROM sqlite_master WHERE name='zotero_import_sources'")){if(!r.next())return;}
        try(var transaction=db.createStatement()) {
            transaction.execute("BEGIN IMMEDIATE");
            try {
                if(transaction.executeUpdate("INSERT OR IGNORE INTO account_migrations(name) VALUES('zotero_collections_v1')") == 1) {
                    var json=new ObjectMapper();int order=0;var initialized=new java.util.HashSet<String>();
                    try(var query=db.createStatement();var rows=query.executeQuery("SELECT DISTINCT source FROM library_collections")){while(rows.next())initialized.add(rows.getString(1));}
                    try(var q=db.createStatement();var rows=q.executeQuery("SELECT document_id,source,collections_json FROM zotero_import_sources ORDER BY imported_at,document_id,attachment")) {
                        while(rows.next()) {
                            String source=rows.getString(2);if(initialized.contains(source))continue;long root=folder(db,source,List.of(),null,source.replaceFirst("(?i)\\.rdf$",""),order++);
                            var paths=json.readTree(rows.getString(3));
                            if(!paths.isArray())continue;
                            if(paths.isEmpty())link(db,rows.getLong(1),root);
                            for(var value:paths) {
                                if(!value.isString())continue;
                                Long parent=root;var path=new ArrayList<String>();
                                for(String name:value.asString().split(" / ",-1)) { path.add(name);parent=folder(db,source,path,parent,name,order++); }
                                link(db,rows.getLong(1),parent);
                            }
                        }
                    }
                }
                transaction.execute("COMMIT");
            } catch(RuntimeException|SQLException failure) {transaction.execute("ROLLBACK");throw failure;}
        }
    }
    private static void link(Connection db,long document,long folder) throws SQLException {
        try(var q=db.prepareStatement("INSERT OR IGNORE INTO document_collections VALUES(?,?)")){q.setLong(1,document);q.setLong(2,folder);q.executeUpdate();}
    }
    public Map<String,Object> collections() throws SQLException {
        var values=new ArrayList<Map<String,Object>>();
        // Count distinct documents throughout each subtree, including documents filed more than once.
        String sql="WITH RECURSIVE branches(root,id) AS (SELECT id,id FROM library_collections UNION SELECT b.root,c.id FROM branches b JOIN library_collections c ON c.parent_id=b.id) SELECT c.*, (SELECT count(DISTINCT x.document_id) FROM document_collections x JOIN branches b ON b.id=x.collection_id WHERE b.root=c.id) AS documents FROM library_collections c ORDER BY c.sort_order,c.id";
        try(var db=library.connect(true);var s=db.createStatement();var rows=s.executeQuery(sql)) {
            while(rows.next()){var value=new LinkedHashMap<String,Object>();value.put("id",rows.getLong("id"));value.put("parent_id",rows.getObject("parent_id"));value.put("name",rows.getString("name"));value.put("count",rows.getLong("documents"));values.add(value);}
            long total,unfiled;
            try(var r=s.executeQuery("SELECT count(*),sum(CASE WHEN NOT EXISTS(SELECT 1 FROM document_collections x WHERE x.document_id=d.id) THEN 1 ELSE 0 END) FROM documents d")){r.next();total=r.getLong(1);unfiled=r.getLong(2);}
            return Map.of("collections",values,"total",total,"unfiled",unfiled);
        }
    }
}
