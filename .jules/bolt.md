## 2024-06-25 - V8 Stack Overflow in Base64 Encoding
**Learning:** Using `String.fromCharCode(...uint8Array)` or `String.fromCharCode.apply(null, uint8Array)` crashes with "Maximum call stack size exceeded" for large arrays (around 100k+ bytes) because JavaScript engines have hard limits on function arguments. Using `.apply` with chunks of 32768 bytes is both safe from stack overflows and significantly faster than spreading the entire array.
**Action:** When converting large TypedArrays to strings, always process in chunks (e.g., 32768 bytes) to avoid V8 call stack limits and improve memory performance.

## 2025-05-22 - Optimized Session Counting by IP
**Learning:** Iterating through a large in-memory session map to count entries by a specific field (e.g., source IP) is an O(N) operation that can become a bottleneck. Using a secondary index (Map of Sets) reduces this to O(M), where M is the number of sessions for that specific IP.
**Action:** Always consider secondary indexing for frequently accessed filters in in-memory stores. Ensure all lifecycle methods (create, delete, cleanup) maintain index consistency.
