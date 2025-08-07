import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: { session_id?: string };
}) {
  console.warn("ATTENTION: La logique de mise à jour de la base de données est temporairement gérée sur la page de succès. Pour la production, configurez et utilisez les webhooks Stripe.");

  const session = await getServerSession(authOptions);

  if (!session?.user?.email || !session?.user?.id) {
    redirect("/login");
  }

  const sessionId = searchParams.session_id;

  if (!sessionId) {
    notFound();
  }

  let stripeSession: Stripe.Checkout.Session;
  let purchaseType: string | undefined;
  let userIdFromStripe: string | undefined;

  try {
    stripeSession = await stripe.checkout.sessions.retrieve(sessionId);
    purchaseType = stripeSession.metadata?.purchaseType;
    userIdFromStripe = stripeSession.metadata?.userId;

    if (userIdFromStripe !== session.user.id) {
      console.error("User ID mismatch between session and Stripe metadata.");
      redirect("/error");
    }

    if (purchaseType !== "product") {
      // Paiement pour l'accès premium (ou si purchaseType n'est pas défini)
      await prisma.user.update({
        where: { id: session.user.id },
        data: { hasPaid: true },
      });
      console.log(`User ${session.user.email} has paid for premium access (via success page).`);
    } else if (purchaseType === "product") {
      // Paiement pour un produit unique
      const productIds = JSON.parse(stripeSession.metadata?.productIds || '[]');
      const shippingCarrier = stripeSession.metadata?.shippingCarrier || 'N/A';
      const shippingCost = parseFloat(stripeSession.metadata?.shippingCost || '0');
      const shippingAddress = stripeSession.metadata?.shippingAddress || 'N/A';
      const totalAmount = parseFloat(stripeSession.metadata?.totalAmount || '0');

      const user = await prisma.user.findUnique({ where: { id: session.user.id } });
      if (!user) {
        console.error("User not found for product purchase in success page.");
        redirect("/error");
      }

      await prisma.order.create({
        data: {
          userId: user.id,
          status: 'paid',
          total: totalAmount,
          shippingCarrier: shippingCarrier,
          shippingCost: shippingCost,
          shippingAddress: shippingAddress,
          items: {
            create: await Promise.all(productIds.map(async (productId: string) => {
              const product = await prisma.product.findUnique({ where: { id: productId } });
              if (!product) {
                throw new Error(`Product ${productId} not found during order creation in success page.`);
              }
              return {
                productId: product.id,
                quantity: 1,
                price: product.price,
              };
            })),
          },
        },
      });
      console.log(`Order created for user ${user.id} (via success page).`);
    }
  } catch (error) {
    console.error("Error processing payment success:", error);
    redirect("/error"); // This redirect is for actual errors in processing
  }

  // Effectuer les redirections finales en dehors du bloc try-catch
  if (purchaseType !== "product") {
    redirect("/premium");
  } else if (purchaseType === "product") {
    redirect("/products");
  }
}