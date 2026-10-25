package org.mathplatform;

import java.io.IOException;
import java.nio.channels.Channels;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.sql.SQLException;
import java.util.Map;
import java.util.Set;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PublicController {
    private static final Set<String> WEB_PATHS = Set.of("/", "/admin", "/admin/", "/admin.js", "/admin-library.js", "/admin-organizer.js", "/admin-books.js", "/admin-series.js", "/series.js", "/ai-learning.js", "/competition.js", "/discussion.js", "/discussion.css", "/admin-competition.js", "/practical-learning.js", "/learning-labs.js", "/study-plan.js", "/admin.css", "/index.html", "/app.js", "/learning.js", "/library.js", "/reader.js", "/reader-djvu.js", "/vendor/djvu/djvu.js", "/vendor/djvu/LICENSE", "/vendor/djvu/NOTICE.md", "/vendor/djvu/README.md", "/reader-ai.js", "/richtext.js", "/vendor/marked/marked.esm.js", "/vendor/dompurify/purify.es.mjs", "/vendor/katex/katex.mjs", "/vendor/katex/katex.min.css", "/icons.js", "/style.css", "/vendor/morphicons/dom.js", "/vendor/morphicons/spring-CFHloqPP.js", "/vendor/morphicons/normalize-CYnN3Npw.js");
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
    public void file(@PathVariable String id, HttpServletRequest request, HttpServletResponse response) throws SQLException, IOException {
        long value = number(id, false, 404);
        DocumentFileResponse.write(library.file(value), value, request, response);
    }

    @GetMapping({"/", "/admin", "/admin/", "/admin.js", "/admin-library.js", "/admin-organizer.js", "/admin-books.js", "/admin-series.js", "/admin-competition.js", "/series.js", "/ai-learning.js", "/competition.js", "/discussion.js", "/discussion.css", "/practical-learning.js", "/learning-labs.js", "/study-plan.js", "/admin.css", "/index.html", "/app.js", "/learning.js", "/library.js", "/reader.js", "/reader-djvu.js", "/vendor/djvu/djvu.js", "/vendor/djvu/LICENSE", "/vendor/djvu/NOTICE.md", "/vendor/djvu/README.md", "/reader-ai.js", "/richtext.js", "/vendor/marked/marked.esm.js", "/vendor/dompurify/purify.es.mjs", "/vendor/katex/katex.mjs", "/vendor/katex/katex.min.css", "/icons.js", "/style.css", "/vendor/morphicons/dom.js", "/vendor/morphicons/spring-CFHloqPP.js", "/vendor/morphicons/normalize-CYnN3Npw.js", "/vendor/pdfjs/**", "/vendor/katex/fonts/**"})
    public ResponseEntity<InputStreamResource> web(HttpServletRequest request) {
        String uri = request.getRequestURI();
        boolean font = uri.matches("/vendor/katex/fonts/[A-Za-z0-9_-]+\\.woff2");
        boolean decoder = uri.matches("/vendor/pdfjs/wasm/(?:openjpeg_nowasm_fallback\\.js|(?:openjpeg|jbig2|qcms_bg)\\.wasm)");
        if (!font && !decoder && !WEB_PATHS.contains(uri) && !uri.matches("/vendor/pdfjs/(pdf(?:\\.worker)?\\.mjs|text_layer\\.css|cmaps/[A-Za-z0-9_-]+\\.bcmap|standard_fonts/[A-Za-z0-9_-]+\\.(?:pfb|ttf))"))
            throw new ApiProblem(404, "not_found");
        String name = uri.startsWith("/admin") && !uri.contains(".") ? "admin.html" : uri.equals("/") ? "index.html" : uri.substring(1);
        String type = name.endsWith(".wasm") ? "application/wasm" : name.startsWith("vendor/djvu/") && !name.endsWith(".js") ? "text/plain; charset=utf-8" : name.endsWith(".woff2") ? "font/woff2" : name.endsWith(".bcmap") || name.endsWith(".pfb") || name.endsWith(".ttf") ? "application/octet-stream" : name.endsWith(".html") ? "text/html; charset=utf-8" : name.endsWith(".css") ? "text/css; charset=utf-8" : "text/javascript; charset=utf-8";
        Path file = Path.of(LibraryRepository.setting("MATH_WEB_DIR", "../frontend")).resolve(name);
        try {
            if (!Files.isRegularFile(file, LinkOption.NOFOLLOW_LINKS)) throw new IOException("Unavailable file");
            long mtime = Files.getLastModifiedTime(file, LinkOption.NOFOLLOW_LINKS).toMillis();
            long size = Files.size(file);
            String etag = "\"" + Long.toHexString(mtime) + "-" + Long.toHexString(size) + "\"";
            if (etag.equals(request.getHeader("If-None-Match"))) {
                return ResponseEntity.status(304).header("ETag", etag).header("Cache-Control", "no-cache").build();
            }
            return resource(file, type, 503, true).header("ETag", etag).header("Cache-Control", "no-cache").build();
        } catch (IOException failure) { throw new ApiProblem(503, "web_unavailable"); }
    }

    @GetMapping("/**")
    public Map<String, String> missing() { throw new ApiProblem(404, "not_found"); }

    /** Hold a non-following channel open throughout response streaming. */
    private static FileBody resource(Path file, String type, int failureStatus, boolean staticAsset) {
        try {
            if (!Files.isRegularFile(file, LinkOption.NOFOLLOW_LINKS)) throw new IOException("Unavailable file");
            var channel = Files.newByteChannel(file, StandardOpenOption.READ, LinkOption.NOFOLLOW_LINKS);
            long size = channel.size();
            if (staticAsset && size > 8388608) { channel.close(); throw new IOException("Oversized asset"); }
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
