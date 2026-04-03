const serverName = 'my-test-server-with-long-name'

console.time('replace_every_loop')
for (let i = 0; i < 100000; i++) {
  const fields = ['field1', 'field2', 'field-three']
  for (const field of fields) {
    const envKey = `MCP_${serverName.toUpperCase().replace(/-/g, '_')}_${field.toUpperCase().replace(/-/g, '_')}`
  }
}
console.timeEnd('replace_every_loop')

console.time('replace_once')
for (let i = 0; i < 100000; i++) {
  const fields = ['field1', 'field2', 'field-three']
  const prefix = `MCP_${serverName.toUpperCase().replace(/-/g, '_')}_`
  for (const field of fields) {
    const envKey = `${prefix}${field.toUpperCase().replace(/-/g, '_')}`
  }
}
console.timeEnd('replace_once')
