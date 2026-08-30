/*
  Warnings:

  - You are about to drop the column `unitPrice` on the `order_items` table. All the data in the column will be lost.
  - You are about to drop the column `totalAmount` on the `orders` table. All the data in the column will be lost.
  - Added the required column `unitPriceInMinorUnits` to the `order_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalAmountInMinorUnits` to the `orders` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "order_items" DROP COLUMN "unitPrice",
ADD COLUMN     "unitPriceInMinorUnits" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "orders" DROP COLUMN "totalAmount",
ADD COLUMN     "totalAmountInMinorUnits" INTEGER NOT NULL;
