package org.mathplatform;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.charset.StandardCharsets;

/** Detect the stored bytes, including legacy extensionless files. */
final class DocumentFormat {
    static String detect(byte[] header) {
        String value = new String(header, StandardCharsets.ISO_8859_1);
        if (value.startsWith("%PDF-")) return "pdf";
        if (header.length >= 16 && value.startsWith("AT&TFORM")
                && (value.substring(12,16).equals("DJVU") || value.substring(12,16).equals("DJVM"))) return "djvu";
        throw new ApiProblem(400, "invalid_document");
    }
    static String of(Path file) {
        try (var input = Files.newInputStream(file, LinkOption.NOFOLLOW_LINKS)) {
            return detect(input.readNBytes(16));
        } catch (IOException failure) { throw new ApiProblem(500, "file_unavailable"); }
    }
    static String mime(String format) { return "djvu".equals(format) ? "image/vnd.djvu" : "application/pdf"; }
}
