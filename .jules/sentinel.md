## 2024-05-24 - [Added helmet security headers]
**Vulnerability:** Missing HTTP security headers (X-Frame-Options, Content-Security-Policy, etc.) on the relay server API.
**Learning:** The relay server, although handling opaque encrypted blobs, did not have basic defense-in-depth security headers configured by default.
**Prevention:** Always include a standard security header middleware like `helmet` in Express applications to provide baseline protections against XSS, clickjacking, and other common web vulnerabilities.
