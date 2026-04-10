## 2024-06-25 - V8 Stack Overflow in Base64 Encoding
**Learning:** Using `String.fromCharCode(...uint8Array)` or `String.fromCharCode.apply(null, uint8Array)` crashes with "Maximum call stack size exceeded" for large arrays (around 100k+ bytes) because JavaScript engines have hard limits on function arguments. Using `.apply` with chunks of 32768 bytes is both safe from stack overflows and significantly faster than spreading the entire array.
**Action:** When converting large TypedArrays to strings, always process in chunks (e.g., 32768 bytes) to avoid V8 call stack limits and improve memory performance.

## 2026-04-10 - [PERF] Efficient Session Cleanup with Priority Queue
**Learning:** Full map iteration for cleanup (O(n)) is inefficient as the number of sessions grows. A Min-Heap based Priority Queue allows for O(k log n) cleanup where k is the number of expired sessions, by always keeping the oldest session at the top.
**Action:** Use `PriorityQueue` for TTL-based expiration tracking instead of full collection scans.
