package org.mathplatform;

import java.sql.SQLException;
import java.util.Map;
import org.springframework.stereotype.Service;

/** Public applications consume the shared library through this service. */
@Service
public class ResearchService {
    private final LibraryRepository library;
    ResearchService(LibraryRepository library) { this.library = library; }
    public Map<String, Object> subjects() throws SQLException { return Map.of("subjects", library.subjects()); }
    public Map<String, Object> reading(long subject, long offset) throws SQLException {
        return Map.of("documents", library.documents(subject, offset), "limit", 20, "offset", offset);
    }
}
