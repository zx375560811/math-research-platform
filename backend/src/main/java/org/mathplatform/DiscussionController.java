package org.mathplatform;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** Authenticated study discussions. Library files and personal notes remain separate. */
@RestController
@RequestMapping("/api/discussions")
public class DiscussionController {
    private static final Set<String> CATEGORIES = Set.of("mathematics", "math-to-ai", "competition", "general");
    private static final String TOPIC = "SELECT t.*,d.title AS document_title,(SELECT count(*) FROM discussion_replies r WHERE r.topic_id=t.id) AS reply_count FROM discussion_topics t LEFT JOIN documents d ON d.id=t.document_id ";
    private final LibraryRepository library;
    private final UserRepository users;
    DiscussionController(LibraryRepository library, UserRepository users) { this.library=library; this.users=users; }
    public record TopicInput(String title, String content, String category, Long document_id, Integer version) {}
    public record ReplyInput(String content, Integer version) {}
    public record Moderation(Boolean pinned, Boolean locked) {}
    private static String text(String value, int max) {
        if (value==null || value.isBlank() || value.codePointCount(0,value.length())>max || value.indexOf('\0')>=0) throw new ApiProblem(400,"invalid_discussion");
        return value.strip();
    }
    private static void offset(int offset) { if(offset<0 || offset>1000000) throw new ApiProblem(400,"invalid_query"); }
    private static void category(String category) { if(!CATEGORIES.contains(category)) throw new ApiProblem(400,"invalid_query"); }
    private static void document(Connection db, Long id) throws SQLException {
        if(id==null) return;
        try(var q=db.prepareStatement("SELECT 1 FROM documents WHERE id=?")){q.setLong(1,id);try(var r=q.executeQuery()){if(!r.next())throw new ApiProblem(404,"not_found");}}
    }
    private Map<String,Object> row(ResultSet r, String username, boolean admin, boolean full) throws SQLException {
        var value=new LinkedHashMap<String,Object>();
        for(String key:new String[]{"id","version","reply_count"}) value.put(key,r.getLong(key));
        for(String key:new String[]{"title","category","author","created_at","updated_at","activity_at"}) value.put(key,r.getString(key));
        String content=r.getString("content");
        value.put(full?"content":"excerpt",full?content:content.substring(0,content.offsetByCodePoints(0,Math.min(160,content.codePointCount(0,content.length())))));
        long id=r.getLong("document_id");value.put("document",id==0?null:Map.of("id",id,"title",LibraryRepository.displayTitle(r.getString("document_title"))));
        value.put("pinned",r.getBoolean("pinned"));value.put("locked",r.getBoolean("locked"));
        value.put("can_edit",r.getString("author").equals(username));value.put("can_delete",admin||r.getString("author").equals(username));
        return value;
    }
    @GetMapping
    public Map<String,Object> list(Authentication user,@RequestParam(defaultValue="") String category,@RequestParam(defaultValue="") String q,
            @RequestParam(defaultValue="all") String scope,@RequestParam(defaultValue="0") int offset) throws SQLException {
        offset(offset);if(!category.isEmpty())category(category);
        if(q.length()>100||!Set.of("all","mine","unanswered").contains(scope))throw new ApiProblem(400,"invalid_query");
        boolean admin=users.isAdmin(user.getName());
        String where=" WHERE (?='' OR t.category=?) AND (?='' OR instr(lower(t.title||char(10)||t.content),lower(?))>0) AND (?<>'mine' OR t.author=?) AND (?<>'unanswered' OR NOT EXISTS(SELECT 1 FROM discussion_replies r WHERE r.topic_id=t.id)) ";
        try(var db=library.connect(true)){
            db.setAutoCommit(false);long total;
            try(var count=db.prepareStatement("SELECT count(*) FROM discussion_topics t"+where)){
                count.setString(1,category);count.setString(2,category);count.setString(3,q.strip());count.setString(4,q.strip());count.setString(5,scope);count.setString(6,user.getName());count.setString(7,scope);
                try(var r=count.executeQuery()){r.next();total=r.getLong(1);}
            }
            var topics=new ArrayList<Map<String,Object>>();
            try(var query=db.prepareStatement(TOPIC+where+"ORDER BY t.pinned DESC,t.activity_at DESC,t.id DESC LIMIT 20 OFFSET ?")){
                query.setString(1,category);query.setString(2,category);query.setString(3,q.strip());query.setString(4,q.strip());query.setString(5,scope);query.setString(6,user.getName());query.setString(7,scope);query.setInt(8,offset);
                try(var r=query.executeQuery()){while(r.next())topics.add(row(r,user.getName(),admin,false));}
            }
            db.commit();return Map.of("topics",topics,"total",total,"total_pages",Math.max(1,(total+19)/20),"limit",20,"offset",offset,"can_moderate",admin);
        }
    }
    @GetMapping("/{id}")
    public Map<String,Object> topic(Authentication user,@PathVariable long id) throws SQLException {
        boolean admin=users.isAdmin(user.getName());
        try(var db=library.connect(true);var q=db.prepareStatement(TOPIC+"WHERE t.id=?")){
            q.setLong(1,id);try(var r=q.executeQuery()){if(!r.next())throw new ApiProblem(404,"not_found");var result=row(r,user.getName(),admin,true);result.put("can_moderate",admin);return result;}
        }
    }
    @PostMapping
    public Map<String,Long> create(Authentication user,@RequestBody TopicInput body) throws SQLException {
        if(body==null)throw new ApiProblem(400,"invalid_discussion");
        String title=text(body.title(),120),content=text(body.content(),12000);category(body.category()==null?"":body.category());
        try(var db=library.connect(false)){
            db.setAutoCommit(false);document(db,body.document_id());
            try(var q=db.prepareStatement("INSERT INTO discussion_topics(author,title,content,category,document_id) VALUES(?,?,?,?,?)")){
                q.setString(1,user.getName());q.setString(2,title);q.setString(3,content);q.setString(4,body.category());q.setObject(5,body.document_id());q.executeUpdate();
            }
            long id;try(var q=db.createStatement();var r=q.executeQuery("SELECT last_insert_rowid()")){r.next();id=r.getLong(1);}db.commit();return Map.of("id",id);
        }
    }
    private static void owned(Connection db, String table, long id, String username, boolean allowAdmin, boolean admin, Integer version) throws SQLException {
        try(var q=db.prepareStatement("SELECT author,version FROM "+table+" WHERE id=?")){
            q.setLong(1,id);try(var r=q.executeQuery()){
                if(!r.next())throw new ApiProblem(404,"not_found");
                if(!username.equals(r.getString(1))&&!(allowAdmin&&admin))throw new ApiProblem(403,"discussion_forbidden");
                if(version!=null&&version!=r.getInt(2))throw new ApiProblem(409,"discussion_changed");
            }
        }
    }
    @PatchMapping("/{id}")
    public Map<String,String> edit(Authentication user,@PathVariable long id,@RequestBody TopicInput body) throws SQLException {
        if(body==null||body.version()==null)throw new ApiProblem(400,"invalid_discussion");
        String title=text(body.title(),120),content=text(body.content(),12000);category(body.category()==null?"":body.category());
        try(var db=library.connect(false);var tx=db.createStatement()){
            tx.execute("BEGIN IMMEDIATE");
            try{
                owned(db,"discussion_topics",id,user.getName(),false,false,body.version());document(db,body.document_id());
                try(var q=db.prepareStatement("UPDATE discussion_topics SET title=?,content=?,category=?,document_id=?,version=version+1,updated_at=strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id=?")){
                    q.setString(1,title);q.setString(2,content);q.setString(3,body.category());q.setObject(4,body.document_id());q.setLong(5,id);q.executeUpdate();
                }tx.execute("COMMIT");
            }catch(SQLException|RuntimeException e){tx.execute("ROLLBACK");throw e;}
        }return Map.of("status","ok");
    }
    @DeleteMapping("/{id}")
    public Map<String,String> delete(Authentication user,@PathVariable long id) throws SQLException {
        boolean admin=users.isAdmin(user.getName());
        try(var db=library.connect(false);var tx=db.createStatement()){
            tx.execute("BEGIN IMMEDIATE");try{
                owned(db,"discussion_topics",id,user.getName(),true,admin,null);
                try(var q=db.prepareStatement("DELETE FROM discussion_topics WHERE id=?")){q.setLong(1,id);q.executeUpdate();}tx.execute("COMMIT");
            }catch(SQLException|RuntimeException e){tx.execute("ROLLBACK");throw e;}
        }return Map.of("status","ok");
    }
    @PatchMapping("/{id}/moderation")
    public Map<String,String> moderate(Authentication user,@PathVariable long id,@RequestBody Moderation body) throws SQLException {
        if(!users.isAdmin(user.getName()))throw new ApiProblem(403,"admin_required");
        if(body==null||body.pinned()==null||body.locked()==null)throw new ApiProblem(400,"invalid_discussion");
        try(var db=library.connect(false);var q=db.prepareStatement("UPDATE discussion_topics SET pinned=?,locked=? WHERE id=?")){
            q.setBoolean(1,body.pinned());q.setBoolean(2,body.locked());q.setLong(3,id);if(q.executeUpdate()==0)throw new ApiProblem(404,"not_found");
        }return Map.of("status","ok");
    }
    @GetMapping("/{id}/replies")
    public Map<String,Object> replies(Authentication user,@PathVariable long id,@RequestParam(defaultValue="0") int offset) throws SQLException {
        offset(offset);boolean admin=users.isAdmin(user.getName());
        try(var db=library.connect(true)){
            db.setAutoCommit(false);
            try(var q=db.prepareStatement("SELECT 1 FROM discussion_topics WHERE id=?")){q.setLong(1,id);try(var r=q.executeQuery()){if(!r.next())throw new ApiProblem(404,"not_found");}}
            long total;try(var q=db.prepareStatement("SELECT count(*) FROM discussion_replies WHERE topic_id=?")){q.setLong(1,id);try(var r=q.executeQuery()){r.next();total=r.getLong(1);}}
            var replies=new ArrayList<Map<String,Object>>();
            try(var q=db.prepareStatement("SELECT * FROM discussion_replies WHERE topic_id=? ORDER BY id LIMIT 20 OFFSET ?")){
                q.setLong(1,id);q.setInt(2,offset);try(var r=q.executeQuery()){while(r.next()){
                    var reply=new LinkedHashMap<String,Object>();for(String key:new String[]{"id","version"})reply.put(key,r.getLong(key));
                    for(String key:new String[]{"author","content","created_at","updated_at"})reply.put(key,r.getString(key));
                    reply.put("can_edit",user.getName().equals(r.getString("author")));reply.put("can_delete",admin||user.getName().equals(r.getString("author")));replies.add(reply);
                }}
            }db.commit();return Map.of("replies",replies,"total",total,"total_pages",Math.max(1,(total+19)/20),"limit",20,"offset",offset);
        }
    }
    @PostMapping("/{id}/replies")
    public Map<String,Long> reply(Authentication user,@PathVariable long id,@RequestBody ReplyInput body) throws SQLException {
        String content=text(body==null?null:body.content(),12000);
        try(var db=library.connect(false);var tx=db.createStatement()){
            tx.execute("BEGIN IMMEDIATE");try{
                try(var q=db.prepareStatement("SELECT locked FROM discussion_topics WHERE id=?")){q.setLong(1,id);try(var r=q.executeQuery()){if(!r.next())throw new ApiProblem(404,"not_found");if(r.getBoolean(1))throw new ApiProblem(409,"discussion_locked");}}
                try(var q=db.prepareStatement("INSERT INTO discussion_replies(topic_id,author,content) VALUES(?,?,?)")){q.setLong(1,id);q.setString(2,user.getName());q.setString(3,content);q.executeUpdate();}
                long replyId;try(var q=db.createStatement();var r=q.executeQuery("SELECT last_insert_rowid()")){r.next();replyId=r.getLong(1);}
                try(var q=db.prepareStatement("UPDATE discussion_topics SET activity_at=strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id=?")){q.setLong(1,id);q.executeUpdate();}
                tx.execute("COMMIT");return Map.of("id",replyId);
            }catch(SQLException|RuntimeException e){tx.execute("ROLLBACK");throw e;}
        }
    }
    @PatchMapping("/replies/{id}")
    public Map<String,String> editReply(Authentication user,@PathVariable long id,@RequestBody ReplyInput body) throws SQLException {
        if(body==null||body.version()==null)throw new ApiProblem(400,"invalid_discussion");String content=text(body.content(),12000);
        try(var db=library.connect(false);var tx=db.createStatement()){
            tx.execute("BEGIN IMMEDIATE");try{
                owned(db,"discussion_replies",id,user.getName(),false,false,body.version());
                try(var q=db.prepareStatement("UPDATE discussion_replies SET content=?,version=version+1,updated_at=strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id=?")){q.setString(1,content);q.setLong(2,id);q.executeUpdate();}tx.execute("COMMIT");
            }catch(SQLException|RuntimeException e){tx.execute("ROLLBACK");throw e;}
        }return Map.of("status","ok");
    }
    @DeleteMapping("/replies/{id}")
    public Map<String,String> deleteReply(Authentication user,@PathVariable long id) throws SQLException {
        boolean admin=users.isAdmin(user.getName());
        try(var db=library.connect(false);var tx=db.createStatement()){
            tx.execute("BEGIN IMMEDIATE");try{
                owned(db,"discussion_replies",id,user.getName(),true,admin,null);
                try(var q=db.prepareStatement("DELETE FROM discussion_replies WHERE id=?")){q.setLong(1,id);q.executeUpdate();}tx.execute("COMMIT");
            }catch(SQLException|RuntimeException e){tx.execute("ROLLBACK");throw e;}
        }return Map.of("status","ok");
    }
}
