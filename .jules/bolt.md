## 2025-05-14 - Optimized Base64url encoding/decoding in frontend
**Learning:** Sequential `.replace()` calls create multiple intermediate strings, which can be suboptimal for performance. A single `.replace()` with a regex and a mapper function is more efficient.
**Action:** Use a single regex-based `.replace()` for multi-character substitutions in performance-sensitive code (like crypto helpers).
