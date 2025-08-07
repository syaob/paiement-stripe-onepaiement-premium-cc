import { PrismaClient } from '@/generated/prisma';
import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import Stripe from 'stripe';

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export default async function ProductPage({
  params,
}: {
  params: { productId: string };
}) {
  const { productId } = await params;
  const session = await getServerSession(authOptions);
  if (!session) {
    return (
      <div className="container mx-auto p-4 text-center">
        <h1 className="text-2xl font-bold">
          Veuillez vous connecter pour acheter ce produit.
        </h1>
      </div>
    );
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    notFound();
  }

  // Fonction pour gérer l'achat
  const handlePurchase = async () => {
    'use server';

    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      // This should not happen if the page requires authentication,
      // but it's a good practice to check.
      return;
    }

    let user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      // User not found in DB despite having a session. This is an unexpected state.
      // Redirect to login or an error page.
      redirect('/login');
    }

    if (!user.stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: session.user.email!,
        name: user.name || session.user.name || session.user.email!,
      });
      user = await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customer.id },
      });
    }

    const stripeSession = await stripe.checkout.sessions.create({
      customer: user?.stripeCustomerId,
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: product.name,
              description: product.description || undefined,
              images: product.image ? [`${process.env.NEXTAUTH_URL}/${product.image}`] : undefined,
            },
            unit_amount: Math.round(product.price * 100),
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Frais de livraison (Standard Shipping)',
            },
            unit_amount: Math.round(5.00 * 100),
          },
          quantity: 1,
        }
      ],
      metadata: {
        userId: session.user.id,
        purchaseType: 'product',
        productIds: JSON.stringify([product.id]),
        shippingCarrier: 'Standard Shipping',
        shippingCost: '5.00',
        shippingAddress: '123 Rue de la Paix, 75001 Paris',
        totalAmount: (product.price + 5.00).toString(),
      },
      success_url: `${process.env.NEXTAUTH_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXTAUTH_URL}/cancel`,
    });

    if (stripeSession.url) {
      redirect(stripeSession.url);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex flex-col md:flex-row gap-8">
        {product.image && (
          <img
            src={product.image}
            alt={product.name}
            className="w-full md:w-1/2 h-96 object-cover rounded-lg shadow-md"
          />
        )}
        <div className="md:w-1/2">
          <h1 className="text-4xl font-bold mb-4">{product.name}</h1>
          <p className="text-gray-700 text-lg mb-6">{product.description}</p>
          <p className="text-2xl font-bold text-blue-600 mb-6">
            {product.price.toFixed(2)} €
          </p>

          <form action={handlePurchase}>
            <button
              type="submit"
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg text-xl"
            >
              Acheter maintenant
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
