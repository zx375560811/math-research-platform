package org.mathplatform;

import java.io.IOException;
import java.nio.channels.Channels;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.sql.SQLException;
import java.util.Map;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PublicController {
    private final LibraryRepository library;
    private final ResearchService research;
    PublicController(LibraryRepository library, ResearchService research) { this.library = library; this.research = research; }
    private static long number(String value, boolean zero, int status) {
        if (value == null) return 0;
        if (!value.matches("[0-9]+")) throw new ApiProblem(status, "invalid_query");
        try {
            long parsed = Long.parseLong(value);
            if (parsed == 0 && !zero) throw new ApiProblem(status, "invalid_query");
            return parsed;
        } catch (NumberFormatException failure) { throw new ApiProblem(status, "invalid_query"); }
    }
    @GetMapping("/api/health")
    public Map<String, String> health() {
        try { library.health(); return Map.of("status", "ok", "database", "ok"); }
        catch (SQLException failure) { throw new ApiProblem(503, "database_unhealthy"); }
    }
    @GetMapping("/api/subjects")
    public Map<String, Object> subjects() throws SQLException { return research.subjects(); }
    @GetMapping("/api/documents")
    public Map<String, Object> documents(@RequestParam(required=false) String subject_id, @RequestParam(required=false) String offset) throws SQLException {
        return research.reading(number(subject_id, false, 400), number(offset, true, 400));
    }
    @GetMapping("/api/documents/{id}")
    public Map<String, Object> document(@PathVariable String id) throws SQLException { return library.document(number(id, false, 404)); }
    @GetMapping("/api/documents/{id}/file")
    public ResponseEntity<InputStreamResource> file(@PathVariable String id) throws SQLException {
        long value = number(id, false, 404);
        return resource(library.file(value), "application/pdf", 500, false)
            .header("Content-Disposition", "attachment; filename=\"document-" + value + ".pdf\"").build();
    }
    @GetMapping("/api/ai/status")
    public Map<String, Object> ai() { return Map.of("enabled", false, "status", "not_configured"); }

    @GetMapping({"/", "/index.html", "/app.js", "/icons.js", "/style.css", "/vendor/morphicons/dom.js", "/vendor/morphicons/spring-CFHloqPP.js", "/vendor/morphicons/normalize-CYnN3Npw.js"})
    public ResponseEntity<InputStreamResource> web(HttpServletRequest request) {
        String name = request.getRequestURI().equals("/") ? "index.html" : request.getRequestURI().substring(1);
        String type = name.endsWith(".html") ? "text/html; charset=utf-8" : name.endsWith(".css") ? "text/css; charset=utf-8" : "text/javascript; charset=utf-8";
        return resource(Path.of(LibraryRepository.setting("MATH_WEB_DIR", "../frontend")).resolve(name), type, 503, true).build();
    }

    /** Hold a non-following channel open throughout response streaming. */
    private static FileBody resource(Path file, String type, int failureStatus, boolean staticAsset) {
        try {
            if (!Files.isRegularFile(file, LinkOption.NOFOLLOW_LINKS)) throw new IOException("Unavailable file");
            var channel = Files.newByteChannel(file, StandardOpenOption.READ, LinkOption.NOFOLLOW_LINKS);
            long size = channel.size();
            if (staticAsset && size > 2097152) { channel.close(); throw new IOException("Oversized asset"); }
            return new FileBody(new InputStreamResource(Channels.newInputStream(channel)), type, size);
        } catch (IOException failure) { throw new ApiProblem(failureStatus, staticAsset ? "web_unavailable" : "file_unavailable"); }
    }
    private static class FileBody {
        private final InputStreamResource body;
        private final ResponseEntity.BodyBuilder response;
        FileBody(InputStreamResource body, String type, long size) { this.body = body; response = ResponseEntity.ok().header("Content-Type", type).contentLength(size); }
        FileBody header(String name, String value) { response.header(name, value); return this; }
        ResponseEntity<InputStreamResource> build() { return response.body(body); }
    }
}
