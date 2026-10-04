package org.mathplatform;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin")
public class AdminLibraryController {
    private final LibraryRepository library;
    private final CollectionRepository collections;
    private final UserRepository users;
    AdminLibraryController(LibraryRepository library, CollectionRepository collections, UserRepository users) throws SQLException {
        this.library=library; this.collections=collections; this.users=users;
        cleanFiles();
    }
    private void authorize(Authentication user) throws SQLException {
        if(user==null || !users.isAdmin(user.getName()))throw new ApiProblem(403,"admin_required");
    }
    private static String name(String value) {
        if(value==null || value.isBlank() || value.getBytes(StandardCharsets.UTF_8).length>500 || value.codePoints().anyMatch(c->c<32 || c==127))throw new ApiProblem(400,"invalid_metadata");
        return value.trim();
    }
    private static List<Long> ids(List<Long> values) {
        if(values==null || values.isEmpty() || values.size()>100 || values.stream().anyMatch(id->id==null || id<1) || Set.copyOf(values).size()!=values.size())throw new ApiProblem(400,"invalid_documents");
        return values;
    }
    private static void folder(Connection db,Long id) throws SQLException {
        if(id==null)return;
        try(var q=db.prepareStatement("SELECT 1 FROM library_collections WHERE id=?")){q.setLong(1,id);try(var r=q.executeQuery()){if(!r.next())throw new ApiProblem(404,"not_found");}}
    }
    private static void duplicate(Connection db,Long parent,String name,long exclude) throws SQLException {
        try(var q=db.prepareStatement("SELECT 1 FROM library_collections WHERE parent_id IS ? AND name=? AND id<>?")){q.setObject(1,parent);q.setString(2,name);q.setLong(3,exclude);try(var r=q.executeQuery()){if(r.next())throw new ApiProblem(409,"collection_name_exists");}}
    }
    private static List<Long> ancestors(Connection db,Long id) throws SQLException {
        var result=new ArrayList<Long>();
        while(id!=null) {
            if(result.contains(id) || result.size()>=30)throw new ApiProblem(400,"invalid_collection_parent");
            result.add(id);
            try(var q=db.prepareStatement("SELECT parent_id FROM library_collections WHERE id=?")){q.setLong(1,id);try(var r=q.executeQuery()){if(!r.next())throw new ApiProblem(404,"not_found");id=r.getObject(1)==null?null:r.getLong(1);}}
        }
        return result;
    }
    public record Name(String name) {}
    public record Folder(String name, Long parent_id) {}
    public record Parent(Long parent_id) {}
    public record Move(List<Long> document_ids,Long collection_id) {}
    public record Removal(List<Long> document_ids,Boolean detach_books) {}
    @GetMapping("/collections")
    public Map<String,Object> collections(Authentication user) throws SQLException {authorize(user);return collections.collections();}
    @PostMapping("/collections")
    public Map<String,Long> create(Authentication user,@RequestBody Folder value) throws SQLException {
        authorize(user);String title=name(value.name);
        try(var db=library.connect(false);var t=db.createStatement()) {
            t.execute("BEGIN IMMEDIATE");
            try {
                if(ancestors(db,value.parent_id).size()>=30)throw new ApiProblem(400,"invalid_collection_parent");
                duplicate(db,value.parent_id,title,0);
                try(var q=db.prepareStatement("INSERT INTO library_collections(source,path_key,parent_id,name,sort_order) VALUES('manual',?,?,?,(SELECT coalesce(max(sort_order),0)+1 FROM library_collections))")){q.setString(1,UUID.randomUUID().toString());q.setObject(2,value.parent_id);q.setString(3,title);q.executeUpdate();}
                long id;try(var r=t.executeQuery("SELECT last_insert_rowid()")){r.next();id=r.getLong(1);}
                t.execute("COMMIT");return Map.of("id",id);
            }catch(SQLException|RuntimeException failure){t.execute("ROLLBACK");throw failure;}
        }
    }
    @PatchMapping("/collections/{id}")
    public Map<String,String> rename(Authentication user,@PathVariable long id,@RequestBody Name value) throws SQLException {
        authorize(user);String title=name(value.name);
        try(var db=library.connect(false);var t=db.createStatement()) {
            t.execute("BEGIN IMMEDIATE");
            try {
                folder(db,id);Long parent;
                try(var q=db.prepareStatement("SELECT parent_id FROM library_collections WHERE id=?")){q.setLong(1,id);try(var r=q.executeQuery()){r.next();parent=r.getObject(1)==null?null:r.getLong(1);}}
                duplicate(db,parent,title,id);
                try(var q=db.prepareStatement("UPDATE library_collections SET name=? WHERE id=?")){q.setString(1,title);q.setLong(2,id);q.executeUpdate();}
                t.execute("COMMIT");
            }catch(SQLException|RuntimeException failure){t.execute("ROLLBACK");throw failure;}
        }
        return Map.of("status","ok");
    }
    @PutMapping("/collections/{id}/parent")
    public Map<String,String> moveFolder(Authentication user,@PathVariable long id,@RequestBody Parent value) throws SQLException {
        authorize(user);
        try(var db=library.connect(false);var t=db.createStatement()) {
            t.execute("BEGIN IMMEDIATE");
            try {
                folder(db,id);var parents=ancestors(db,value.parent_id);
                if(parents.contains(id))throw new ApiProblem(400,"invalid_collection_parent");
                try(var q=db.prepareStatement("WITH RECURSIVE children(id,depth) AS (SELECT ?,1 UNION ALL SELECT c.id,s.depth+1 FROM library_collections c JOIN children s ON c.parent_id=s.id) SELECT max(depth) FROM children")){q.setLong(1,id);try(var r=q.executeQuery()){r.next();if(parents.size()+r.getInt(1)>30)throw new ApiProblem(400,"invalid_collection_parent");}}
                String title;try(var q=db.prepareStatement("SELECT name FROM library_collections WHERE id=?")){q.setLong(1,id);try(var r=q.executeQuery()){r.next();title=r.getString(1);}}
                duplicate(db,value.parent_id,title,id);
                try(var q=db.prepareStatement("UPDATE library_collections SET parent_id=? WHERE id=?")){q.setObject(1,value.parent_id);q.setLong(2,id);q.executeUpdate();}
                t.execute("COMMIT");
            }catch(SQLException|RuntimeException failure){t.execute("ROLLBACK");throw failure;}
        }
        return Map.of("status","ok");
    }
    @DeleteMapping("/collections/{id}")
    public Map<String,String> removeFolder(Authentication user,@PathVariable long id) throws SQLException {
        authorize(user);
        try(var db=library.connect(false);var q=db.prepareStatement("DELETE FROM library_collections WHERE id=? AND NOT EXISTS(SELECT 1 FROM library_collections WHERE parent_id=?) AND NOT EXISTS(SELECT 1 FROM document_collections WHERE collection_id=?)")) {
            q.setLong(1,id);q.setLong(2,id);q.setLong(3,id);
            if(q.executeUpdate()==0){folder(db,id);throw new ApiProblem(409,"collection_not_empty");}
        }
        return Map.of("status","ok");
    }
    @PatchMapping("/documents/{id}/name")
    public Map<String,String> renameDocument(Authentication user,@PathVariable long id,@RequestBody Name value) throws SQLException {
        authorize(user);String title=name(value.name);
        try(var db=library.connect(false);var q=db.prepareStatement("UPDATE documents SET title=? WHERE id=?")){q.setString(1,title);q.setLong(2,id);if(q.executeUpdate()!=1)throw new ApiProblem(404,"not_found");}
        return Map.of("status","ok");
    }
    @PostMapping("/documents/move")
    public Map<String,String> moveDocuments(Authentication user,@RequestBody Move value) throws SQLException {
        authorize(user);var documents=ids(value.document_ids);
        try(var db=library.connect(false);var t=db.createStatement()) {
            t.execute("BEGIN IMMEDIATE");
            try {
                folder(db,value.collection_id);
                for(long id:documents) {
                    try(var q=db.prepareStatement("SELECT 1 FROM documents WHERE id=?")){q.setLong(1,id);try(var r=q.executeQuery()){if(!r.next())throw new ApiProblem(404,"not_found");}}
                    try(var q=db.prepareStatement("DELETE FROM document_collections WHERE document_id=?")){q.setLong(1,id);q.executeUpdate();}
                    if(value.collection_id!=null)try(var q=db.prepareStatement("INSERT INTO document_collections VALUES(?,?)")){q.setLong(1,id);q.setLong(2,value.collection_id);q.executeUpdate();}
                }
                t.execute("COMMIT");
            }catch(SQLException|RuntimeException failure){t.execute("ROLLBACK");throw failure;}
        }
        return Map.of("status","ok");
    }
    @PostMapping("/documents/batch-delete")
    public Map<String,Object> removeDocuments(Authentication user,@RequestBody Removal value) throws SQLException {
        authorize(user);var documents=ids(value.document_ids);
        try(var db=library.connect(false);var t=db.createStatement()) {
            t.execute("BEGIN IMMEDIATE");
            try {
                for(long id:documents) {
                    String path;try(var q=db.prepareStatement("SELECT file_path FROM documents WHERE id=?")){q.setLong(1,id);try(var r=q.executeQuery()){if(!r.next())throw new ApiProblem(404,"not_found");path=r.getString(1);}}
                    if(!path.matches("data/files/upload-[A-Za-z0-9_-]+"))throw new ApiProblem(500,"file_unavailable");
                    if(!Boolean.TRUE.equals(value.detach_books))try(var q=db.prepareStatement("SELECT 1 FROM learning_books WHERE document_id=?")){q.setLong(1,id);try(var r=q.executeQuery()){if(r.next())throw new ApiProblem(409,"document_in_use");}}
                    for(String table:List.of("learning_progress","learning_marks"))try(var q=db.prepareStatement("DELETE FROM "+table+" WHERE book_id IN(SELECT id FROM learning_books WHERE document_id=?)")){q.setLong(1,id);q.executeUpdate();}
                    try(var q=db.prepareStatement("UPDATE learning_books SET document_id=NULL WHERE document_id=?")){q.setLong(1,id);q.executeUpdate();}
                    // Legacy importer tables may predate foreign-key cascades.
                    for(String table:List.of("zotero_import_sources","zotero_import_hashes")) {
                        boolean exists;try(var q=db.prepareStatement("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?")){q.setString(1,table);try(var r=q.executeQuery()){exists=r.next();}}
                        if(exists)try(var q=db.prepareStatement("DELETE FROM "+table+" WHERE document_id=?")){q.setLong(1,id);q.executeUpdate();}
                    }
                    try(var q=db.prepareStatement("INSERT OR IGNORE INTO library_file_cleanup(path) VALUES(?)")){q.setString(1,path);q.executeUpdate();}
                    try(var q=db.prepareStatement("DELETE FROM documents WHERE id=?")){q.setLong(1,id);q.executeUpdate();}
                }
                t.execute("COMMIT");
            }catch(SQLException|RuntimeException failure){t.execute("ROLLBACK");throw failure;}
        }
        return Map.of("status","ok","cleanup_pending",cleanFiles());
    }
    private int cleanFiles() throws SQLException {
        try(var db=library.connect(false);var t=db.createStatement()) {
            t.execute("BEGIN IMMEDIATE");
            try {
                var paths=new ArrayList<String>();
                try(var r=t.executeQuery("SELECT path FROM library_file_cleanup")){while(r.next())paths.add(r.getString(1));}
                for(String path:paths) {
                    if(!path.matches("data/files/upload-[A-Za-z0-9_-]+"))continue;
                    boolean used;try(var q=db.prepareStatement("SELECT 1 FROM documents WHERE file_path=?")){q.setString(1,path);try(var r=q.executeQuery()){used=r.next();}}
                    if(!used)try {Files.deleteIfExists(Path.of(path));}catch(IOException failure){continue;}
                    try(var q=db.prepareStatement("DELETE FROM library_file_cleanup WHERE path=?")){q.setString(1,path);q.executeUpdate();}
                }
                int pending;try(var r=t.executeQuery("SELECT count(*) FROM library_file_cleanup")){r.next();pending=r.getInt(1);}
                t.execute("COMMIT");return pending;
            }catch(SQLException|RuntimeException failure){t.execute("ROLLBACK");throw failure;}
        }
    }
}
