## 2025-05-15 - [SECURITY] Unvalidated Input Size and Type in Relay Server
**Vulnerability:** Unvalidated input size and type in `packages/relay-server/src/routes/sessions.ts` could lead to memory exhaustion and type confusion vulnerabilities.
**Learning:** Even with an express global JSON limit, individual fields must be validated for type and structure. `express.json()` can parse fields as objects or arrays even when strings are expected, which can bypass simple `.length` checks or cause unexpected behavior.
**Prevention:**
1. Use `typeof field === 'string'` for all expected string inputs.
2. For object inputs, verify they are not `null` and not arrays (`typeof schema === 'object' && schema !== null && !Array.isArray(schema)`).
3. Wrap `JSON.stringify()` on user-provided objects in `try-catch` to handle non-serializable data.
4. Enforce strict length and size limits on every field.
