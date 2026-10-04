package org.mathplatform;

import java.sql.SQLException;
import java.util.Map;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/library-ai")
public class LibraryOrganizerController {
    private final LibraryOrganizer organizer;
    private final UserRepository users;
    LibraryOrganizerController(LibraryOrganizer organizer,UserRepository users){this.organizer=organizer;this.users=users;}
    private void authorize(Authentication user) throws SQLException {if(user==null||!users.isAdmin(user.getName()))throw new ApiProblem(403,"admin_required");}
    public record Start(String source,Long collection_id) {}
    public record Control(String action) {}
    @GetMapping
    public Map<String,Object> status(Authentication user) throws SQLException {authorize(user);return organizer.status();}
    @PostMapping
    public Map<String,Object> start(Authentication user,@RequestBody Start body) throws SQLException {authorize(user);return organizer.start(user.getName(),body.source,body.collection_id);}
    @PostMapping("/{id}/control")
    public Map<String,Object> control(Authentication user,@PathVariable String id,@RequestBody Control body) throws SQLException {authorize(user);return organizer.control(user.getName(),id,body.action);}
}
