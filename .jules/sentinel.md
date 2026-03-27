## 2025-02-27 - PBKDF2 Iterations Increase
**Vulnerability:** Weak PBKDF2 iterations (100,000) for key derivation from machine ID and passphrases.
**Learning:** Legacy configurations that use only 100,000 iterations need to still be decryptable, otherwise users will lose their data upon a simple package upgrade. We must be backward-compatible when hardening cryptography.
**Prevention:** Hardcoded cryptographic parameters like `PBKDF2_ITERATIONS` were updated from 100,000 to 600,000 to meet modern standards. Fallback logic to attempt 100,000 iterations was added when the 600,000 default fails to successfully decrypt files or exports.
