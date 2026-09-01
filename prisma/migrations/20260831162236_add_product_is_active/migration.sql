/*
  Warnings:

  - The `currency` column on the `orders` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `currency` column on the `products` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'CNY', 'SEK', 'NZD');

-- AlterTable
ALTER TABLE "orders" DROP COLUMN "currency",
ADD COLUMN     "currency" "Currency" NOT NULL DEFAULT 'USD';

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
DROP COLUMN "currency",
ADD COLUMN     "currency" "Currency" NOT NULL DEFAULT 'USD';

-- CreateIndex
CREATE INDEX "products_currency_idx" ON "products"("currency");
