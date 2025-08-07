import { PrismaClient } from '@/generated/prisma';
import Link from 'next/link';

const prisma = new PrismaClient();

export default async function ProductsPage() {
  const products = await prisma.product.findMany();

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Nos Produits</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => (
          <div key={product.id} className="border rounded-lg p-4 shadow-md">
            {product.image && (
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-48 object-cover rounded-md mb-4"
              />
            )}
            <h2 className="text-xl font-semibold mb-2">{product.name}</h2>
            <p className="text-gray-600 mb-4">{product.description}</p>
            <div className="flex justify-between items-center">
              <span className="text-lg font-bold">{product.price.toFixed(2)} €</span>
              <Link
                href={`/products/${product.id}`}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
              >
                Voir le produit
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
