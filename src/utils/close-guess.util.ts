export const isCloseGuess = (guess: string, word: string): boolean => {
  if (guess.length !== word.length) return false;

  let mismatchCount = 0;
  let mismatchIndexes: number[] = [];

  for (let i = 0; i < word.length; i++) {
    if (guess[i] !== word[i]) {
      mismatchCount++;
      mismatchIndexes.push(i);
    }

    if (mismatchCount > 2) return false;
  }

  if (mismatchCount === 1) return true;

  if (mismatchCount === 2) {
    const [i, j] = mismatchIndexes;
    if (guess[i] === word[j] && guess[j] === word[i]) {
      return true;
    }
  }

  return false;
};
