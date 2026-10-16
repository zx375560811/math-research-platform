PDF.js 5.6.205, Apache-2.0. Vendored from the bundled pdfjs-dist distribution.
Upstream: https://github.com/mozilla/pdf.js
Includes display/worker modules, text-layer CSS, CMaps and standard fonts.

Local modification (2026-10-16): replace the display and worker bundles' native
Map/WeakMap.getOrInsertComputed calls with a private getCachedValue helper using
has/get/set. This fixes the reported first-page rendering error when that native
method is absent. Cached promises, objects and falsy values retain their identity;
no global prototypes are patched. Keep this change in both bundles when updating
PDF.js. The original version, license and document-loading behavior are retained.

Regression: node frontend/tests/pdf-cache.cjs renders pages and text, reads outlines
and cached metadata, and verifies HTTP byte ranges with the native method removed
from both the page and a real PDF worker. It also checks Map/WeakMap cache values.
