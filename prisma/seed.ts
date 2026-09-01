import 'dotenv/config';

import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not configured');
}

const adapter = new PrismaPg({
  connectionString: databaseUrl,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.product.upsert({
    where: {
      id: '11111111-1111-1111-1111-111111111111',
    },
    update: {
      name: 'Test Product USD',
      priceInMinorUnits: 1000,
      currency: 'USD',
      isActive: true,
    },
    create: {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Test Product USD',
      priceInMinorUnits: 1000,
      currency: 'USD',
      isActive: true,
    },
  });

  await prisma.product.upsert({
    where: {
      id: '22222222-2222-2222-2222-222222222222',
    },
    update: {
      name: 'Second Product USD',
      priceInMinorUnits: 2500,
      currency: 'USD',
      isActive: true,
    },
    create: {
      id: '22222222-2222-2222-2222-222222222222',
      name: 'Second Product USD',
      priceInMinorUnits: 2500,
      currency: 'USD',
      isActive: true,
    },
  });

  await prisma.product.upsert({
    where: {
      id: '33333333-3333-3333-3333-333333333333',
    },
    update: {
      name: 'Test Product EUR',
      priceInMinorUnits: 1500,
      currency: 'EUR',
      isActive: true,
    },
    create: {
      id: '33333333-3333-3333-3333-333333333333',
      name: 'Test Product EUR',
      priceInMinorUnits: 1500,
      currency: 'EUR',
      isActive: true,
    },
  });

  await prisma.product.upsert({
    where: {
      id: '44444444-4444-4444-4444-444444444444',
    },
    update: {
      name: 'Test Product GBP',
      priceInMinorUnits: 1200,
      currency: 'GBP',
      isActive: true,
    },
    create: {
      id: '44444444-4444-4444-4444-444444444444',
      name: 'Test Product GBP',
      priceInMinorUnits: 1200,
      currency: 'GBP',
      isActive: true,
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
