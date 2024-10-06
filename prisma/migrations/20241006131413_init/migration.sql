/*
  Warnings:

  - A unique constraint covering the columns `[word,languageCode]` on the table `Word` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Word_word_languageCode_key" ON "Word"("word", "languageCode");
