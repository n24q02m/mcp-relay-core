const WORDLIST_LEN = 7776;
const max = Math.floor(0x10000 / WORDLIST_LEN) * WORDLIST_LEN;
console.log('max:', max);
const samples = 10000;
let biased = 0;
for (let i = 0; i < samples; i++) {
  const index = Math.floor(Math.random() * 0x10000);
  if (index >= max) biased++;
}
console.log('biased samples (approx):', biased);
