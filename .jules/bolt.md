## 2024-06-25 - V8 Stack Overflow in Base64 Encoding
**Learning:** Using `String.fromCharCode(...uint8Array)` or `String.fromCharCode.apply(null, uint8Array)` crashes with "Maximum call stack size exceeded" for large arrays (around 100k+ bytes) because JavaScript engines have hard limits on function arguments. Using `.apply` with chunks of 32768 bytes is both safe from stack overflows and significantly faster than spreading the entire array.
**Action:** When converting large TypedArrays to strings, always process in chunks (e.g., 32768 bytes) to avoid V8 call stack limits and improve memory performance.
## 2024-04-08 - String formatting in loops
**Learning:** In tight Python loops dealing with configuration keys, `re.sub` incurs unnecessary overhead for simple string replacements. Furthermore, redundant computations of static strings within the loop magnify this inefficiency.
**Action:** Always prefer `str.replace` over `re.sub` for straightforward character substitution and proactively hoist loop-invariant values outside the loop body for better performance.
