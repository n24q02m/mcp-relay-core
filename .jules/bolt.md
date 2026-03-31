## 2024-06-25 - V8 Stack Overflow in Base64 Encoding
**Learning:** Using `String.fromCharCode(...uint8Array)` or `String.fromCharCode.apply(null, uint8Array)` crashes with "Maximum call stack size exceeded" for large arrays (around 100k+ bytes) because JavaScript engines have hard limits on function arguments. Using `.apply` with chunks of 32768 bytes is both safe from stack overflows and significantly faster than spreading the entire array.
**Action:** When converting large TypedArrays to strings, always process in chunks (e.g., 32768 bytes) to avoid V8 call stack limits and improve memory performance.

## 2025-03-31 - O(N) Complexity in Express Rate Limiting
**Learning:** During creation of a new session object, iterating through an array/map of all active connections just to count connections for a specific IP (`countSessionsByIp`) creates an O(N) bottleneck on session creation requests. This creates an unoptimized cold path during bursts of requests and uses excess CPU.
**Action:** Store connected IP counts in a separate tracking Map (`ipCounts`) using `O(1)` map lookups. Increment counters on session create, and decrement them upon TTL timeout or session deletion instead of recounting the array.
