package org.mathplatform;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.nio.channels.SeekableByteChannel;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpRange;

/** Authenticated document responses; seek to ranges without buffering whole books. */
final class DocumentFileResponse {
    private record Part(long start, long end) {
        long length() { return end - start + 1; }
    }

    private static SeekableByteChannel open(Path file) {
        try {
            if (!Files.isRegularFile(file, LinkOption.NOFOLLOW_LINKS)) throw new IOException("Unavailable file");
            return Files.newByteChannel(file, StandardOpenOption.READ, LinkOption.NOFOLLOW_LINKS);
        } catch (IOException failure) { throw new ApiProblem(500, "file_unavailable"); }
    }

    static void write(Path file, long id, HttpServletRequest request, HttpServletResponse response) throws IOException {
        // Keep the validated descriptor open for header detection and every requested range.
        try (var channel = open(file)) {
            long size = channel.size();
            var signature = ByteBuffer.allocate(16);
            while (signature.hasRemaining() && channel.read(signature) > 0) { }
            String format = DocumentFormat.detect(java.util.Arrays.copyOf(signature.array(), signature.position()));
            String type = DocumentFormat.mime(format);
            response.setHeader("Accept-Ranges", "bytes");
            response.setHeader("Content-Disposition", "attachment; filename=\"document-" + id + "." + format + "\"");
            response.setContentType(type);
            boolean head = request.getMethod().equals("HEAD");
            String range = request.getHeader("Range");
            List<Part> parts = List.of();
            // No validators are emitted: an If-Range cannot match, so send a complete response.
            if (!head && range != null && request.getHeader("If-Range") == null && range.startsWith("bytes=")) {
                try {
                    parts = ranges(range, size);
                } catch (IllegalArgumentException invalid) {
                    response.setStatus(416);
                    response.setHeader("Content-Range", "bytes */" + size);
                    response.setContentLengthLong(0);
                    return;
                }
            }
            if (parts.isEmpty()) {
                response.setStatus(200);
                response.setContentLengthLong(size);
                if (!head) copy(channel, response.getOutputStream(), new Part(0, size - 1));
            } else if (parts.size() == 1) {
                Part part = parts.get(0);
                response.setStatus(206);
                response.setHeader("Content-Range", contentRange(part, size));
                response.setContentLengthLong(part.length());
                copy(channel, response.getOutputStream(), part);
            } else {
                String boundary = "math-" + UUID.randomUUID();
                var headers = new ArrayList<byte[]>();
                long length = 0;
                for (Part part : parts) {
                    byte[] header = ascii("--" + boundary + "\r\nContent-Type: " + type + "\r\nContent-Range: " + contentRange(part, size) + "\r\n\r\n");
                    headers.add(header);
                    length += header.length + part.length() + 2;
                }
                byte[] closing = ascii("--" + boundary + "--\r\n");
                response.setStatus(206);
                response.setContentType("multipart/byteranges; boundary=" + boundary);
                response.setContentLengthLong(length + closing.length);
                OutputStream output = response.getOutputStream();
                for (int i = 0; i < parts.size(); i++) {
                    output.write(headers.get(i));
                    copy(channel, output, parts.get(i));
                    output.write(ascii("\r\n"));
                }
                output.write(closing);
            }
        }
    }

    private static List<Part> ranges(String header, long size) {
        List<HttpRange> requested = HttpRange.parseRanges(header);
        if (requested.isEmpty()) throw new IllegalArgumentException("Empty range");
        // RFC 9110 permits ignoring excessive/overlapping requests. Bound amplification.
        if (requested.size() > 16) return List.of();
        var parts = new ArrayList<Part>();
        long total = 0;
        for (HttpRange range : requested) {
            long start = range.getRangeStart(size), end = range.getRangeEnd(size);
            if (start < 0 || start >= size || end < start) continue;
            Part part = new Part(start, end);
            if (part.length() > size - total) return List.of();
            total += part.length();
            parts.add(part);
        }
        if (parts.isEmpty()) throw new IllegalArgumentException("Unsatisfiable range");
        return parts;
    }

    private static String contentRange(Part part, long size) {
        return "bytes " + part.start() + "-" + part.end() + "/" + size;
    }
    private static byte[] ascii(String value) { return value.getBytes(StandardCharsets.US_ASCII); }

    private static void copy(SeekableByteChannel channel, OutputStream output, Part part) throws IOException {
        channel.position(part.start());
        var buffer = ByteBuffer.allocate(64 * 1024);
        long remaining = part.length();
        while (remaining > 0) {
            buffer.clear().limit((int) Math.min(buffer.capacity(), remaining));
            int count = channel.read(buffer);
            if (count < 0) throw new IOException("Document changed during transfer");
            if (count == 0) continue;
            output.write(buffer.array(), 0, count);
            remaining -= count;
        }
    }
}
