const WORDLIST = ['apple', 'banana', 'drop-down', 'down', 't-shirt', 'shirt', 'yo-yo'];
const passphrase = 'drop-down-apple-yo-yo-t-shirt';

let remaining = passphrase;
const sortedWordlist = [...WORDLIST].sort((a, b) => b.length - a.length);
let matched = 0;
for (const word of sortedWordlist) {
    while (remaining.includes(word)) {
        remaining = remaining.replace(word, "TOKEN");
        matched++;
    }
}
console.log('Remaining:', remaining);
console.log('Matched:', matched);
