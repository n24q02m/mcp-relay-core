import time
import re

server_name = "my-test-server-with-long-name"
fields = ["field1", "field2", "field-three"]

start = time.time()
for _ in range(100000):
    for field in fields:
        env_key = (
            "MCP_"
            + re.sub(r"-", "_", server_name).upper()
            + "_"
            + re.sub(r"-", "_", field).upper()
        )
end = time.time()
print(f"replace_every_loop: {end - start:.4f}s")

start = time.time()
for _ in range(100000):
    prefix = "MCP_" + server_name.upper().replace("-", "_") + "_"
    for field in fields:
        env_key = prefix + field.upper().replace("-", "_")
end = time.time()
print(f"replace_once: {end - start:.4f}s")
