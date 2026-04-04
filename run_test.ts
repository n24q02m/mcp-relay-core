import { WORDLIST } from './packages/core-ts/src/relay/wordlist.js'

function generatePassphrase(wordCount = 4) {
  const words = []
  const max = Math.floor(0x10000 / WORDLIST.length) * WORDLIST.length
  for (let i = 0; i < wordCount; i++) {
    let index
    do {
      index = crypto.getRandomValues(new Uint16Array(1))[0]
    } while (index >= max)
    words.push(WORDLIST[index % WORDLIST.length])
  }
  return words.join('-')
}

const passphrase = generatePassphrase()
console.log(passphrase)
let remaining = passphrase
let valid = true
while (remaining.length > 0) {
  const matchingWord = WORDLIST.find(w => remaining.startsWith(w + '-') || remaining === w)
  if (!matchingWord) {
    valid = false
    break
  }
  remaining = remaining.substring(matchingWord.length)
  if (remaining.startsWith('-')) {
      remaining = remaining.substring(1)
  }
}
console.log(valid)
