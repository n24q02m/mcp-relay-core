## 2024-03-25 - Caching OS-level queries avoids redundant latency overhead
**Learning:** Running OS-level queries like `ioreg` on macOS, `reg` on Windows, or reading from `/etc/machine-id` on Linux are expensive operations relative to purely computational JS limits. Doing these repeatedly for every piece of config loaded compounds to meaningful latency over time in this architecture.
**Action:** When a static piece of system information is needed (such as machine IDs or user contexts), cache it globally after initial resolution to eliminate recurrent I/O waits.
