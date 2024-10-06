import { PrismaClient } from '@prisma/client';
import fs from 'fs-extra';
import path from 'path';

const prisma = new PrismaClient();

async function seedWords() {
  // Truncate the 'Word' table (delete all existing records)
  await prisma.word.deleteMany({});
  console.log('Table truncated.');

  const wordsDirectory = path.join(__dirname, 'words'); // Adjust the path to your 'words' folder
  const files = await fs.readdir(wordsDirectory); // Get all files in the directory

  // Loop over each file
  for (const file of files) {
    const languageCode = path.basename(file, '.txt'); // Extract the language code from the file name
    const filePath = path.join(wordsDirectory, file);
    const content = await fs.readFile(filePath, 'utf-8'); // Read the file content

    // Split content into words (each line is a word)
    const words = content.split('\n').filter((word) => word.trim() !== ''); // Remove any empty lines

    // Insert words into the database
    for (const word of words) {
      await prisma.word.create({
        data: {
          word: word.trim(),
          languageCode,
        },
      });
    }
    console.log(`Seeded ${words.length} words for language ${languageCode}`);
  }
}

seedWords()
  .then(() => console.log('Seeding completed'))
  .catch((error) => console.error(error))
  .finally(async () => {
    await prisma.$disconnect();
  });
