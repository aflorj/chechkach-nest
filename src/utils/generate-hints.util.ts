export const generateHints = (word: string) => {
  const result = [];

  // Generate two distinct random indexes
  let index1, index2;
  do {
    index1 = Math.floor(Math.random() * word.length);
    index2 = Math.floor(Math.random() * word.length);
  } while (index1 === index2);

  // Create objects with index and letter properties
  result.push({ index: index1, letter: word[index1] });
  result.push({ index: index2, letter: word[index2] });

  return result;
};
