## 2024-06-25 - V8 Stack Overflow in Base64 Encoding
**Learning:** Using `String.fromCharCode(...uint8Array)` or `String.fromCharCode.apply(null, uint8Array)` crashes with "Maximum call stack size exceeded" for large arrays (around 100k+ bytes) because JavaScript engines have hard limits on function arguments. Using `.apply` with chunks of 32768 bytes is both safe from stack overflows and significantly faster than spreading the entire array.
**Action:** When converting large TypedArrays to strings, always process in chunks (e.g., 32768 bytes) to avoid V8 call stack limits and improve memory performance.
## 2024-06-25 - Python String Formatting Over Regex
**Learning:** In simple formatting tasks like prefix creation inside loops, using `f-strings` and `str.replace` dramatically outperforms `re.sub`.
**Action:** Default to string manipulation methods (`str.replace`, `f-strings`) over Python's `re` module for basic search-and-replace patterns in execution paths. Ensure invariants are hoisted out of execution loops.
