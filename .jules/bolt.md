## 2024-06-25 - V8 Stack Overflow in Base64 Encoding
**Learning:** Using `String.fromCharCode(...uint8Array)` or `String.fromCharCode.apply(null, uint8Array)` crashes with "Maximum call stack size exceeded" for large arrays (around 100k+ bytes) because JavaScript engines have hard limits on function arguments. Using `.apply` with chunks of 32768 bytes is both safe from stack overflows and significantly faster than spreading the entire array.
**Action:** When converting large TypedArrays to strings, always process in chunks (e.g., 32768 bytes) to avoid V8 call stack limits and improve memory performance.

## 2026-04-02 - Frontend E2E Test Synchronization with UI Status Transitions
**Learning:** In the frontend form submission flow, the UI displays a '.status-info' message immediately after form submission, and only transitions to '.status-success' after background polling completes. End-to-end UI tests must assert the '.status-info' state immediately following submission to avoid race conditions and timeouts while waiting for an asynchronous state change that hasn't happened yet.
**Action:** When writing Playwright tests for form submissions in this repository, always verify the '.status-info' element's visibility as the primary indicator that the request was successfully sent, before optionally waiting for further status updates.
