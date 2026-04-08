import { WORDLIST } from './packages/core-ts/src/relay/wordlist.js'

const wordSet = new Set(WORDLIST)

function checkPassphrase(passphrase: string) {
  // Try to split by '-' but handle the case where a word itself contains a '-'
  // This is tricky.
  // Let's try to match words from the wordlist greedily.
  let remaining = passphrase;
  const foundWords = [];

  // We need to be careful with words like 'drop-down' vs 'drop' and 'down'.
  // If 'drop-down' is in the wordlist, we should prefer it.

  while (remaining.length > 0) {
    let found = false;
    // Try to find the longest prefix that is a word in the wordlist
    // Since we know the separator is '-', we can split by '-' and then re-join if needed?
    // Actually, if we split by '-', we might break 'drop-down' into 'drop' and 'down'.

    // Let's look at the first part until '-'
    const parts = remaining.split('-');

    // Try parts[0], then parts[0] + '-' + parts[1], etc.
    for (let i = 1; i <= parts.length; i++) {
      const candidate = parts.slice(0, i).join('-');
      if (wordSet.has(candidate)) {
        foundWords.push(candidate);
        remaining = parts.slice(i).join('-');
        found = true;
        break;
      }
    }

    if (!found) {
      console.log(`Failed to find word for: ${remaining}`);
      return false;
    }
  }
  console.log(`Found words: ${foundWords.join(', ')}`);
  return true;
}

// Mock generatePassphrase logic
const testPassphrases = [
  'alpha-bravo-charlie-delta',
  'drop-down-t-shirt-yo-yo-felt-tip',
  'alpha-drop-down-bravo-delta'
];

for (const p of testPassphrases) {
  console.log(`Checking: ${p}`);
  checkPassphrase(p);
}
