## 2025-05-14 - Unvalidated Input Size in Relay Server

**Learning:** Lack of explicit size validation for complex input objects (like the `schema` in session creation) can lead to memory exhaustion even if global body limits are in place, if those limits are too permissive. Defaulting to a 1MB limit for an API that primarily handles small JSON objects is a risk.

**Action:**
1. Always set the most restrictive global JSON body limit possible (e.g., 100KB instead of 1MB).
2. For specific fields that are stored in memory or databases, implement field-level size validation (e.g., `JSON.stringify(obj).length`).
3. Ensure security tests include boundary checks for payload and field sizes.
