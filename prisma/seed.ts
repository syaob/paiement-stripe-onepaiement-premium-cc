import { PrismaClient } from '@/generated/prisma';
const prisma = new PrismaClient();

async function main() {
  await prisma.product.deleteMany({}); // Nettoie les anciens produits

  await prisma.product.createMany({
    data: [
      {
        name: 'T-shirt Next.js',
        description: 'Un t-shirt confortable avec le logo de Next.js.',
        price: 25.50,
        image: '/products/tshirt-next.png',
      },
      {
        name: 'Mug React',
        description: 'Commencez votre journée avec du code et du café.',
        price: 15.00,
        image: '/products/mug-react.png',
      },
      {
        name: 'Sticker Vercel',
        description: 'Un sticker de haute qualité pour votre ordinateur portable.',
        price: 4.99,
        image: '/products/sticker-vercel.png',
      },
    ],
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
