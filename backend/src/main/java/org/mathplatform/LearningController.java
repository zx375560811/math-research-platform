package org.mathplatform;

import java.sql.SQLException;
import java.util.Map;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/learning")
public class LearningController {
    private final LearningRepository learning;
    LearningController(LearningRepository learning) { this.learning = learning; }
    @GetMapping("/directions") public Map<String, Object> directions() throws SQLException { return Map.of("directions", learning.directions()); }
    @GetMapping("/directions/{slug}") public Map<String, Object> direction(@PathVariable String slug, Authentication user) throws SQLException { return learning.direction(slug, user.getName()); }
    @GetMapping("/books/{book}") public Map<String, Object> book(@PathVariable long book, Authentication user) throws SQLException { return learning.book(book, user.getName()); }
    @PutMapping("/books/{book}/progress") public Map<String, String> progress(@PathVariable long book, @RequestBody LearningRepository.Progress progress, Authentication user) throws SQLException { learning.progress(book, user.getName(), progress); return Map.of("status", "ok"); }
    @GetMapping("/books/{book}/annotations") public Map<String, Object> marks(@PathVariable long book, Authentication user) throws SQLException { return Map.of("annotations", learning.marks(book, user.getName())); }
    @PostMapping("/books/{book}/annotations") public Map<String, Long> create(@PathVariable long book, @RequestBody LearningRepository.Mark mark, Authentication user) throws SQLException { return Map.of("id", learning.createMark(book, user.getName(), mark)); }
    @PatchMapping("/books/{book}/annotations/{mark}") public Map<String, String> edit(@PathVariable long book, @PathVariable long mark, @RequestBody LearningRepository.Note note, Authentication user) throws SQLException { learning.editMark(book, mark, user.getName(), note); return Map.of("status", "ok"); }
    @DeleteMapping("/books/{book}/annotations/{mark}") public Map<String, String> delete(@PathVariable long book, @PathVariable long mark, Authentication user) throws SQLException { learning.deleteMark(book, mark, user.getName()); return Map.of("status", "ok"); }
}
