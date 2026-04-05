import sys

with open('.github/workflows/cd.yml', 'r') as f:
    lines = f.readlines()

new_lines = []
in_pypi_job = False
in_build_step = False
skip_next = False

for line in lines:
    if 'publish-pypi:' in line:
        in_pypi_job = True
    if in_pypi_job and 'build-docker:' in line:
        in_pypi_job = False

    if in_pypi_job and 'name: Build and publish' in line:
        in_build_step = True
        new_lines.append(line)
        continue

    if in_build_step and 'run: |' in line:
        new_lines.append('        env:\n')
        new_lines.append('          UV_PUBLISH_TOKEN: ${{ secrets.PYPI_TOKEN }}\n')
        new_lines.append('        run: |\n')
        new_lines.append('          cd packages/core-py\n')
        new_lines.append('          uv build\n')
        new_lines.append("          # Check if version already exists on PyPI\n")
        new_lines.append("          VERSION=$(grep -m 1 'version =' pyproject.toml | cut -d '\"' -f 2)\n")
        new_lines.append("          if curl -s -f \"https://pypi.org/pypi/mcp-relay-core/$VERSION/json\" > /dev/null; then\n")
        new_lines.append("            echo \"mcp-relay-core@$VERSION already published, skipping\"\n")
        new_lines.append("          else\n")
        new_lines.append("            uv publish\n")
        new_lines.append("          fi\n")
        in_build_step = False
        skip_next = True
        continue

    if skip_next:
        if line.strip() == '' or line.startswith('  '):
            if 'cd packages/core-py' in line or 'uv build' in line or 'uv publish' in line:
                continue
            else:
                skip_next = False
        else:
            skip_next = False

    if not skip_next:
        new_lines.append(line)

with open('.github/workflows/cd.yml', 'w') as f:
    f.writelines(new_lines)
