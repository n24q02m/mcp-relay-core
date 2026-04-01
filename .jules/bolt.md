## 2024-06-25 - V8 Stack Overflow in Base64 Encoding
**Learning:** Using `String.fromCharCode(...uint8Array)` or `String.fromCharCode.apply(null, uint8Array)` crashes with "Maximum call stack size exceeded" for large arrays (around 100k+ bytes) because JavaScript engines have hard limits on function arguments. Using `.apply` with chunks of 32768 bytes is both safe from stack overflows and significantly faster than spreading the entire array.
**Action:** When converting large TypedArrays to strings, always process in chunks (e.g., 32768 bytes) to avoid V8 call stack limits and improve memory performance.
## 2026-04-01 - Server-Side Filtering for Polling Endpoints
**Learning:** Polling endpoints (like waiting for a specific message response) can return all responses for a session, causing the network payload and client parsing overhead to grow continuously as the session accumulates messages.
**Action:** When creating polling endpoints where the client is waiting for a specific item (e.g., via a `messageId`), support an optional query parameter to filter the results server-side. This keeps polling payloads minimal (O(1) instead of O(N)) and avoids wasteful client-side filtering.
