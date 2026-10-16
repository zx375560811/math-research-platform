package org.mathplatform;

import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** Mathematics-major competition materials backed by the shared library. */
@RestController
public class CompetitionController {
    private final LibraryRepository library;
    private final DocumentReadingRepository reading;
    private final UserRepository users;
    CompetitionController(LibraryRepository library,DocumentReadingRepository reading,UserRepository users){this.library=library;this.reading=reading;this.users=users;}
    private void admin(Authentication user)throws SQLException{if(!users.isAdmin(user.getName()))throw new ApiProblem(403,"admin_required");}
    @GetMapping({"/api/competition","/api/admin/competition"})
    public Map<String,Object> courses(Authentication user)throws SQLException{
        var courses=new ArrayList<Map<String,Object>>();
        try(var db=library.connect(true);var query=db.createStatement();var rows=query.executeQuery("SELECT * FROM competition_courses ORDER BY sort_order")){
            while(rows.next()){
                var course=new LinkedHashMap<String,Object>();
                for(String key:new String[]{"slug","name","phase","topics","practice"})course.put(key,rows.getString(key));
                var books=new ArrayList<Map<String,Object>>();
                try(var links=db.prepareStatement("SELECT document_id,sort_order FROM competition_books WHERE course=? ORDER BY sort_order,document_id")){
                    links.setString(1,rows.getString("slug"));try(var linked=links.executeQuery()){while(linked.next()){var book=reading.reading(linked.getLong(1),user.getName());book.put("sort_order",linked.getInt(2));books.add(book);}}
                }
                course.put("books",books);courses.add(course);
            }
        }
        return Map.of("courses",courses);
    }
    public record Book(Long document_id,Integer sort_order){}
    @PostMapping("/api/admin/competition/{course}/books")
    public Map<String,Object> add(Authentication user,@PathVariable String course,@RequestBody Book body)throws SQLException{
        admin(user);if(body==null||body.document_id()==null||body.document_id()<=0||body.sort_order()!=null&&(body.sort_order()<0||body.sort_order()>1000000))throw new ApiProblem(400,"invalid_query");
        try(var db=library.connect(false)){
            try(var q=db.prepareStatement("SELECT 1 FROM competition_courses WHERE slug=?")){q.setString(1,course);try(var r=q.executeQuery()){if(!r.next())throw new ApiProblem(404,"not_found");}}
            library.document(body.document_id());
            int order=body.sort_order()==null?0:body.sort_order();
            if(body.sort_order()==null)try(var q=db.prepareStatement("SELECT coalesce(max(sort_order),-10)+10 FROM competition_books WHERE course=?")){q.setString(1,course);try(var r=q.executeQuery()){r.next();order=r.getInt(1);}}
            try(var q=db.prepareStatement("INSERT OR IGNORE INTO competition_books VALUES(?,?,?)")){q.setString(1,course);q.setLong(2,body.document_id());q.setInt(3,order);int added=q.executeUpdate();return Map.of("added",added);}
        }
    }
    @PatchMapping("/api/admin/competition/{course}/books/{document}")
    public Map<String,String> order(Authentication user,@PathVariable String course,@PathVariable long document,@RequestBody Book body)throws SQLException{
        admin(user);if(body==null||body.sort_order()==null||body.sort_order()<0||body.sort_order()>1000000)throw new ApiProblem(400,"invalid_query");
        try(var db=library.connect(false);var q=db.prepareStatement("UPDATE competition_books SET sort_order=? WHERE course=? AND document_id=?")){q.setInt(1,body.sort_order());q.setString(2,course);q.setLong(3,document);if(q.executeUpdate()==0)throw new ApiProblem(404,"not_found");}return Map.of("status","ok");
    }
    @DeleteMapping("/api/admin/competition/{course}/books/{document}")
    public Map<String,String> remove(Authentication user,@PathVariable String course,@PathVariable long document)throws SQLException{
        admin(user);try(var db=library.connect(false);var q=db.prepareStatement("DELETE FROM competition_books WHERE course=? AND document_id=?")){q.setString(1,course);q.setLong(2,document);if(q.executeUpdate()==0)throw new ApiProblem(404,"not_found");}return Map.of("status","ok");
    }
}
