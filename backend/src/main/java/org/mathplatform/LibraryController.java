package org.mathplatform;

import java.sql.SQLException;
import java.util.Map;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/library")
public class LibraryController {
    private final CatalogRepository catalog;
    private final DocumentReadingRepository reading;
    private final CollectionRepository collections;
    LibraryController(CatalogRepository catalog, DocumentReadingRepository reading, CollectionRepository collections) { this.collections=collections; this.catalog = catalog; this.reading = reading; }
    @GetMapping("/collections") public Map<String,Object> collections() throws SQLException { return collections.collections(); }
    @GetMapping("/categories") public Map<String,Object> categories() throws SQLException { return catalog.categories(); }
    @GetMapping("/documents") public Map<String,Object> documents(@RequestParam(defaultValue="") String module, @RequestParam(defaultValue="") String direction, @RequestParam(defaultValue="") String language, @RequestParam(defaultValue="") String q, @RequestParam(defaultValue="0") int offset, @RequestParam(defaultValue="") String collection, Authentication user) throws SQLException { return catalog.documents(module, direction, language, q, offset, user.getName(), collection); }
    @GetMapping("/documents/{id}") public Map<String,Object> document(@PathVariable long id, Authentication user) throws SQLException { return reading.reading(id, user.getName()); }
    @PutMapping("/documents/{id}/progress") public Map<String,String> progress(@PathVariable long id, @RequestBody LearningRepository.Progress value, Authentication user) throws SQLException { reading.progress(id, user.getName(), value); return Map.of("status","ok"); }
    @GetMapping("/documents/{id}/annotations") public Map<String,Object> marks(@PathVariable long id, Authentication user) throws SQLException { return Map.of("annotations",reading.marks(id,user.getName())); }
    @PostMapping("/documents/{id}/annotations") public Map<String,Long> create(@PathVariable long id, @RequestBody LearningRepository.Mark value, Authentication user) throws SQLException { return Map.of("id",reading.createMark(id,user.getName(),value)); }
    @PatchMapping("/documents/{id}/annotations/{mark}") public Map<String,String> edit(@PathVariable long id, @PathVariable long mark, @RequestBody LearningRepository.Note value, Authentication user) throws SQLException { reading.editMark(id,mark,user.getName(),value); return Map.of("status","ok"); }
    @DeleteMapping("/documents/{id}/annotations/{mark}") public Map<String,String> delete(@PathVariable long id, @PathVariable long mark, Authentication user) throws SQLException { reading.deleteMark(id,mark,user.getName()); return Map.of("status","ok"); }
}
