package org.mathplatform;

import java.io.IOException;
import java.nio.channels.Channels;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** Curated local exercises and learner-reported stages. No user code runs on the server. */
@RestController
@RequestMapping("/api/learning-labs")
public class LearningLabController {
    private static final Set<String> LABS=Set.of("calculus","linear-algebra","python","machine-learning","deep-learning","pytorch","nlp","llm");
    private static final List<String> STAGES=List.of("follow","fill","independent");
    private final LibraryRepository library;
    LearningLabController(LibraryRepository library){this.library=library;}
    private static void lab(String slug){if(!LABS.contains(slug))throw new ApiProblem(404,"not_found");}
    private static List<String> stages(int mask){var result=new ArrayList<String>();for(int i=0;i<3;i++)if((mask&(1<<i))!=0)result.add(STAGES.get(i));return result;}
    @GetMapping("/progress")
    public Map<String,Object> progress(Authentication user)throws SQLException{
        var result=new LinkedHashMap<String,Object>();
        try(var db=library.connect(true);var q=db.prepareStatement("SELECT lab,stages FROM learning_lab_progress WHERE username=?")){
            q.setString(1,user.getName());try(var rows=q.executeQuery()){while(rows.next())if(LABS.contains(rows.getString(1)))result.put(rows.getString(1),stages(rows.getInt(2)));}
        }
        return Map.of("progress",result);
    }
    public record Stage(String stage,Boolean completed){}
    @PutMapping("/{slug}/progress")
    public Map<String,Object> save(Authentication user,@PathVariable String slug,@RequestBody Stage body)throws SQLException{
        lab(slug);if(body==null||body.stage()==null||!STAGES.contains(body.stage())||body.completed()==null)throw new ApiProblem(400,"invalid_query");
        int bit=1<<STAGES.indexOf(body.stage());
        try(var db=library.connect(false)){
            try(var q=db.prepareStatement("INSERT INTO learning_lab_progress(username,lab,stages) VALUES(?,?,?) ON CONFLICT(username,lab) DO UPDATE SET stages=CASE WHEN ? THEN stages|? ELSE stages&? END,updated_at=strftime('%Y-%m-%dT%H:%M:%SZ','now')")){
                q.setString(1,user.getName());q.setString(2,slug);q.setInt(3,body.completed()?bit:0);q.setBoolean(4,body.completed());q.setInt(5,bit);q.setInt(6,~bit);q.executeUpdate();
            }
            try(var q=db.prepareStatement("SELECT stages FROM learning_lab_progress WHERE username=? AND lab=?")){
                q.setString(1,user.getName());q.setString(2,slug);try(var row=q.executeQuery()){row.next();return Map.of("completed_stages",stages(row.getInt(1)));}
            }
        }
    }
    @GetMapping("/{slug}/notebook")
    public ResponseEntity<InputStreamResource> notebook(Authentication user,@PathVariable String slug)throws IOException{
        lab(slug);
        Path file=Path.of(LibraryRepository.setting("MATH_WEB_DIR","../frontend")).resolve("labs").resolve(slug+".ipynb");
        if(!Files.isRegularFile(file,LinkOption.NOFOLLOW_LINKS))throw new ApiProblem(503,"lab_unavailable");
        var channel=Files.newByteChannel(file,StandardOpenOption.READ,LinkOption.NOFOLLOW_LINKS);
        long size=channel.size();if(size>8388608){channel.close();throw new ApiProblem(503,"lab_unavailable");}
        return ResponseEntity.ok().header("Content-Type","application/x-ipynb+json; charset=utf-8")
            .header("Content-Disposition","attachment; filename=\"axiom-"+slug+".ipynb\"")
            .header("Cache-Control","no-store").contentLength(size)
            .body(new InputStreamResource(Channels.newInputStream(channel)));
    }
}
