package org.mathplatform;

import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** Personal references to shared books; reading positions stay owned by the document. */
@RestController
@RequestMapping("/api/study-plan")
public class StudyPlanController {
    private final LibraryRepository library;
    StudyPlanController(LibraryRepository library) { this.library = library; }
    private static final String JOIN = " FROM study_plan s JOIN documents d ON d.id=s.document_id LEFT JOIN document_progress p ON p.document_id=s.document_id AND p.username=s.username ";
    private static final String STATUS = "CASE WHEN s.completed=1 THEN 'completed' WHEN p.page IS NOT NULL THEN 'learning' ELSE 'planned' END";
    @GetMapping("/members")
    public Map<String,Object> members(Authentication user) throws SQLException {
        var ids=new ArrayList<Long>();
        try(var db=library.connect(true);var q=db.prepareStatement("SELECT document_id FROM study_plan WHERE username=? ORDER BY document_id")) {
            q.setString(1,user.getName());try(var rows=q.executeQuery()){while(rows.next())ids.add(rows.getLong(1));}
        }
        return Map.of("document_ids",ids);
    }
    @GetMapping
    public Map<String,Object> list(Authentication user, @RequestParam(defaultValue="planned") String scope, @RequestParam(defaultValue="0") int offset) throws SQLException {
        if (!Set.of("planned","progress").contains(scope) || offset < 0 || offset > 1000000) throw new ApiProblem(400,"invalid_query");
        try (var db=library.connect(true)) {
            var counts=new LinkedHashMap<String,Long>();
            counts.put("planned",0L); counts.put("learning",0L); counts.put("completed",0L);
            // One read transaction keeps counts and the page consistent with each other.
            db.setAutoCommit(false);
            try (var q=db.prepareStatement("SELECT "+STATUS+" AS state,count(*)"+JOIN+"WHERE s.username=? GROUP BY state")) {
                q.setString(1,user.getName()); try (var rows=q.executeQuery()) { while(rows.next()) counts.put(rows.getString(1),rows.getLong(2)); }
            }
            long total=scope.equals("planned") ? counts.get("planned") : counts.get("learning")+counts.get("completed");
            var books=new ArrayList<Map<String,Object>>();
            String filter=scope.equals("planned") ? "s.completed=0 AND p.page IS NULL" : "(s.completed=1 OR p.page IS NOT NULL)";
            try (var q=db.prepareStatement("SELECT d.id,d.title,d.authors,s.source,s.added_at,"+STATUS+" AS state,p.page,p.total_pages,p.updated_at"+JOIN+"WHERE s.username=? AND "+filter+" ORDER BY s.completed,coalesce(p.updated_at,s.added_at) DESC,d.id DESC LIMIT 20 OFFSET ?")) {
                q.setString(1,user.getName()); q.setInt(2,offset);
                try (var rows=q.executeQuery()) { while(rows.next()) {
                    var value=new LinkedHashMap<String,Object>();value.put("id",rows.getLong("id"));value.put("title",LibraryRepository.displayTitle(rows.getString("title")));
                    for(String key:new String[]{"authors","source","added_at","state"}) value.put(key,rows.getString(key));
                    int page=rows.getInt("page");value.put("progress",page==0?null:Map.of("page",page,"total_pages",rows.getInt("total_pages"),"updated_at",rows.getString("updated_at")));
                    books.add(value);
                } }
            }
            db.commit();
            return Map.of("books",books,"summary",counts,"total",total,"total_pages",Math.max(1,(total+19)/20),"offset",offset,"limit",20);
        }
    }
    public record Entry(String source,Boolean completed) {}
    @PutMapping("/{document}")
    public Map<String,Object> add(Authentication user,@PathVariable long document,@RequestBody Entry value) throws SQLException {
        if(value==null||value.source()==null||!Set.of("library","mathematics","series","math-to-ai").contains(value.source())) throw new ApiProblem(400,"invalid_query");
        try(var db=library.connect(false)) {
            try(var q=db.prepareStatement("SELECT 1 FROM documents WHERE id=?")) { q.setLong(1,document);try(var row=q.executeQuery()){if(!row.next())throw new ApiProblem(404,"not_found");} }
            try(var q=db.prepareStatement("INSERT OR IGNORE INTO study_plan(username,document_id,source) VALUES(?,?,?)")) {
                q.setString(1,user.getName());q.setLong(2,document);q.setString(3,value.source());return Map.of("added",q.executeUpdate()==1);
            }
        }
    }
    @PatchMapping("/{document}")
    public Map<String,String> complete(Authentication user,@PathVariable long document,@RequestBody Entry value) throws SQLException {
        if(value==null||value.completed()==null)throw new ApiProblem(400,"invalid_query");
        try(var db=library.connect(false);var q=db.prepareStatement("UPDATE study_plan SET completed=? WHERE username=? AND document_id=?")) {
            q.setInt(1,value.completed()?1:0);q.setString(2,user.getName());q.setLong(3,document);if(q.executeUpdate()==0)throw new ApiProblem(404,"not_found");
        }
        return Map.of("status","ok");
    }
    @DeleteMapping("/{document}")
    public Map<String,String> remove(Authentication user,@PathVariable long document) throws SQLException {
        try(var db=library.connect(false);var q=db.prepareStatement("DELETE FROM study_plan WHERE username=? AND document_id=?")) {
            q.setString(1,user.getName());q.setLong(2,document);if(q.executeUpdate()==0)throw new ApiProblem(404,"not_found");
        }
        return Map.of("status","ok");
    }
}
