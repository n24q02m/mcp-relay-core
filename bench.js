const b64 = 'ab+cd/ef=gh'.repeat(1000)

console.time('sequential')
for (let i = 0; i < 10000; i++) {
  b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}
console.timeEnd('sequential')

const map = { '+': '-', '/': '_', '=': '' }
console.time('single_regex')
for (let i = 0; i < 10000; i++) {
  b64.replace(/[+/=]/g, (m) => map[m])
}
console.timeEnd('single_regex')

console.time('single_regex_inline')
for (let i = 0; i < 10000; i++) {
  b64.replace(/[+/=]/g, (m) => ({ '+': '-', '/': '_' })[m] ?? '')
}
console.timeEnd('single_regex_inline')
