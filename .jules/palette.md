## 2025-05-22 - [Optimization] Suboptimal Base64url encoding
**Learning:** Sequential `.replace()` calls for characters like `+`, `/`, and `=` in Base64 strings can be optimized using a single regex and a mapper function.
**Action:** Replaced multiple `.replace()` calls with `.replace(/[+/=]/g, m => ({ '+': '-', '/': '_' }[m] ?? ''))` in `pages/shared/crypto.js` to improve performance by reducing intermediate string allocations.
