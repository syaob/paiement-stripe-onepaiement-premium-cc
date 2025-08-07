import Stripe from "stripe";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-07-30",
});

export async function POST(req: Request) {
  const body = await req.text();
  const signature = headers().get("Stripe-Signature") as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error: any) {
    console.error("Webhook Error:", error.message);
    return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const purchaseType = session.metadata?.purchaseType;

      if (!userId) {
        console.error("User ID not found in metadata.");
        return new NextResponse("User ID not found", { status: 400 });
      }

      if (purchaseType === "product") {
        // Logique pour les paiements de produits uniques
        const productIds = JSON.parse(session.metadata?.productIds || "[]");
        const shippingCarrier = session.metadata?.shippingCarrier || "N/A";
        const shippingCost = parseFloat(session.metadata?.shippingCost || "0");
        const shippingAddress = session.metadata?.shippingAddress || "N/A";
        const totalAmount = parseFloat(session.metadata?.totalAmount || "0");

        // Créer la commande dans la base de données
        const order = await prisma.order.create({
          data: {
            userId: userId,
            status: "paid",
            total: totalAmount,
            shippingCarrier: shippingCarrier,
            shippingCost: shippingCost,
            shippingAddress: shippingAddress,
            items: {
              create: await Promise.all(
                productIds.map(async (productId: string) => {
                  const product = await prisma.product.findUnique({
                    where: { id: productId },
                  });
                  if (!product) {
                    throw new Error(
                      `Product ${productId} not found during order creation.`
                    );
                  }
                  return {
                    productId: product.id,
                    quantity: 1, // Pour l'instant, on suppose 1 par produit, à adapter si panier avec quantités
                    price: product.price,
                  };
                })
              ),
            },
          },
        });
        console.log(`Order ${order.id} created for user ${userId}.`);
      } else {
        // Gérer le paiement unique pour l'accès premium (ou si purchaseType n'est pas défini)
        await prisma.user.update({
          where: { id: userId },
          data: { hasPaid: true },
        });
        console.log(`User ${userId} has paid for premium access.`);
      }
  }
}
