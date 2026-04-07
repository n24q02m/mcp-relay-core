## 2024-04-07 - Missing HTTP Error Validation in Fetch Calls

**Vulnerability:** UI hang and lack of error feedback when API calls fail with HTTP error statuses (e.g., 500, 404).
**Learning:** The JavaScript `fetch` API only throws an error on network failures (e.g., DNS, connection refused). It does not throw for HTTP error responses (4xx, 5xx). Code that assumes `fetch` will jump to the `catch` block on any non-successful response will leave the UI in an inconsistent state (e.g., buttons remaining disabled).
**Prevention:** Always check `response.ok` or the specific `response.status` after a `fetch` call and explicitly throw an error or handle the failure case to ensure the UI can recover and inform the user.
