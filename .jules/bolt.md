## 2024-06-25 - V8 Stack Overflow in Base64 Encoding
**Learning:** Using `String.fromCharCode(...uint8Array)` or `String.fromCharCode.apply(null, uint8Array)` crashes with "Maximum call stack size exceeded" for large arrays (around 100k+ bytes) because JavaScript engines have hard limits on function arguments. Using `.apply` with chunks of 32768 bytes is both safe from stack overflows and significantly faster than spreading the entire array.
**Action:** When converting large TypedArrays to strings, always process in chunks (e.g., 32768 bytes) to avoid V8 call stack limits and improve memory performance.

## 2026-04-03 - Server-side Polling Filter
**Learning:** Client-side polling of large arrays with `Array.find()` leads to O(N) complexity per iteration and unnecessary network overhead. Implementing a `messageId` query parameter on the server allows for O(1) server-side lookup and reduces the network response to only the relevant data.
**Action:** Always implement server-side filtering (e.g., via query parameters) for polling endpoints to minimize client-side processing and network payload sizes.
