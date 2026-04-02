## 2024-06-25 - V8 Stack Overflow in Base64 Encoding
**Learning:** Using `String.fromCharCode(...uint8Array)` or `String.fromCharCode.apply(null, uint8Array)` crashes with "Maximum call stack size exceeded" for large arrays (around 100k+ bytes) because JavaScript engines have hard limits on function arguments. Using `.apply` with chunks of 32768 bytes is both safe from stack overflows and significantly faster than spreading the entire array.
**Action:** When converting large TypedArrays to strings, always process in chunks (e.g., 32768 bytes) to avoid V8 call stack limits and improve memory performance.
## 2025-05-14 - Blocking the event loop with synchronous sleeps
**Learning:** Using `time.sleep` in a library designed for asynchronous environments (like MCP servers) blocks the entire event loop, preventing other concurrent tasks from progressing. This is especially problematic in I/O bound operations like config file retries.
**Action:** Always prefer asynchronous APIs (`async def`, `await asyncio.sleep`) for library functions that might be called within an async context, even if the primary use case currently seems synchronous.
