PDF.js 5.6.205, Apache-2.0. Vendored from the bundled pdfjs-dist distribution.
Upstream: https://github.com/mozilla/pdf.js
Includes display/worker modules, text-layer CSS, CMaps, standard fonts and the
matching distribution's wasm/ decoders with their original license files.

Scanned PDFs (2026-10-16): the reader supplies wasmUrl=/vendor/pdfjs/wasm/ and
enables the bundled OpenJPEG (JPEG 2000), JBIG2/CCITT and QCMS decoders. OpenJPEG's
JavaScript fallback is also self-hosted. No external CDN or server conversion is
required. The static controller explicitly permits these four decoder assets,
serves .wasm as application/wasm, and the CSP permits WebAssembly compilation
with wasm-unsafe-eval while JavaScript eval remains disabled. Rebuild/restart
the Java backend when deploying this change, then force-refresh the browser.

Regression: node frontend/tests/pdf-images.cjs renders an original synthetic PDF
with a JPEG first page and JPEG 2000 later pages in the actual continuous reader.
It checks visible image pixels, scrolling away and back, partial HTTP requests,
and the automatic JavaScript fallback when the Wasm download fails.

Local modification (2026-10-16): replace the display and worker bundles' native
Map/WeakMap.getOrInsertComputed calls with a private getCachedValue helper using
has/get/set. This fixes the reported first-page rendering error when that native
method is absent. Cached promises, objects and falsy values retain their identity;
no global prototypes are patched. Keep this change in both bundles when updating
PDF.js. The original version, license and document-loading behavior are retained.

Local modification (2026-10-28): in both `pdf.mjs` and `pdf.worker.mjs`, add
compatibility shims at the top of the bundle for `Promise.try`,
`Uint8Array.prototype.toBase64` and `Response.bytes()`. They only activate when the
browser runtime lacks the native method, and fix the reported continuous-scroll
hang on older Chromium/WebView builds. These are the only built-in prototype
patches in the repository. When upgrading PDF.js, re-apply the shims, or replace
them with a separate polyfill loaded before the module. The worker also falls back
to `arrayBuffer()` when `Response.bytes()` is unavailable.

Regression: node frontend/tests/pdf-cache.cjs renders pages and text, reads outlines
and cached metadata, and verifies HTTP byte ranges with the native method removed
from both the page and a real PDF worker. It also checks Map/WeakMap cache values.
