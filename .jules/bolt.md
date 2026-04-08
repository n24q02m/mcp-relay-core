## 2024-06-25 - V8 Stack Overflow in Base64 Encoding
**Learning:** Using `String.fromCharCode(...uint8Array)` or `String.fromCharCode.apply(null, uint8Array)` crashes with "Maximum call stack size exceeded" for large arrays (around 100k+ bytes) because JavaScript engines have hard limits on function arguments. Using `.apply` with chunks of 32768 bytes is both safe from stack overflows and significantly faster than spreading the entire array.
**Action:** When converting large TypedArrays to strings, always process in chunks (e.g., 32768 bytes) to avoid V8 call stack limits and improve memory performance.

## 2025-02-12 - Python String replacement optimization in loops
**Learning:** Using `str.replace` instead of `re.sub` for simple string character substitutions is roughly 8x-10x faster in tight loops. Additionally, pulling constants (like `server_prefix` calculations) out of loops rather than re-computing them on every iteration dramatically improves performance when dealing with string building based on configurations.
**Action:** When performing simple static substring replacements in Python, always prefer `str.replace` over compiling or using the `re` module. Always identify loop-invariant string constructions and pull them out of loops.
