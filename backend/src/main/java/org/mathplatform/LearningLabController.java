package org.mathplatform;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Reviewed, pinned textbook companions. Code is displayed as data, never executed. */
@RestController
@RequestMapping("/api/learning-labs")
public class LearningLabController {
    private final LibraryRepository library;
    private final ObjectMapper json = new ObjectMapper();
    private final JsonNode catalogue;
    private final Map<String, Map<String, Boolean>> chapters = new LinkedHashMap<>();

    LearningLabController(LibraryRepository library) throws IOException {
        this.library = library;
        try (var source = getClass().getResourceAsStream("/textbook-labs.json")) {
            if (source == null) throw new IOException("Missing textbook-labs.json");
            catalogue = json.readTree(source);
        }
        for (var book : catalogue.path("books")) {
            String id = book.path("id").asString();
            if (!id.matches("[a-z0-9-]+")) throw new IOException("Invalid companion id");
            var entries = new LinkedHashMap<String, Boolean>();
            for (var chapter : book.path("chapters")) {
                String name = chapter.path("id").asString();
                if (!name.matches("[a-z0-9-]+")) throw new IOException("Invalid chapter id");
                entries.put(name, chapter.path("preview").asBoolean());
            }
            chapters.put(id, entries);
        }
    }

    private boolean chapter(String book, String chapter) {
        var entries = chapters.get(book);
        if (entries == null || !entries.containsKey(chapter)) throw new ApiProblem(404, "not_found");
        return entries.get(chapter);
    }

    @GetMapping("/catalog")
    public JsonNode catalogue() { return catalogue; }

    @GetMapping("/progress")
    public Map<String, Object> progress(Authentication user) throws SQLException {
        var result = new LinkedHashMap<String, List<String>>();
        try (var db = library.connect(true); var query = db.prepareStatement(
            "SELECT book,chapter FROM textbook_lab_progress WHERE username=? ORDER BY book,chapter")) {
            query.setString(1, user.getName());
            try (var rows = query.executeQuery()) {
                while (rows.next()) {
                    String book = rows.getString(1), chapter = rows.getString(2);
                    if (chapters.containsKey(book) && chapters.get(book).containsKey(chapter))
                        result.computeIfAbsent(book, key -> new ArrayList<>()).add(chapter);
                }
            }
        }
        return Map.of("progress", result);
    }

    public record Completion(Boolean completed) {}

    @PutMapping("/{book}/chapters/{chapter}/progress")
    public Map<String, Object> save(Authentication user, @PathVariable String book,
        @PathVariable String chapter, @RequestBody Completion body) throws SQLException {
        chapter(book, chapter);
        if (body == null || body.completed() == null) throw new ApiProblem(400, "invalid_query");
        try (var db = library.connect(false); var query = db.prepareStatement(body.completed()
            ? "INSERT OR IGNORE INTO textbook_lab_progress(username,book,chapter) VALUES(?,?,?)"
            : "DELETE FROM textbook_lab_progress WHERE username=? AND book=? AND chapter=?")) {
            query.setString(1, user.getName()); query.setString(2, book); query.setString(3, chapter);
            query.executeUpdate();
        }
        return Map.of("completed", body.completed());
    }

    @GetMapping("/{book}/chapters/{chapter}/preview")
    public JsonNode preview(@PathVariable String book, @PathVariable String chapter) throws IOException {
        if (!chapter(book, chapter)) throw new ApiProblem(404, "preview_not_available");
        Path file = Path.of(LibraryRepository.setting("MATH_WEB_DIR", "../frontend"))
            .resolve("labs/upstream").resolve(book).resolve(chapter + ".json");
        if (!Files.isRegularFile(file, LinkOption.NOFOLLOW_LINKS)) throw new ApiProblem(503, "lab_unavailable");
        try (var channel = Files.newByteChannel(file, StandardOpenOption.READ, LinkOption.NOFOLLOW_LINKS)) {
            if (channel.size() > 4194304) throw new ApiProblem(503, "lab_unavailable");
            return json.readTree(java.nio.channels.Channels.newInputStream(channel));
        }
    }
}
