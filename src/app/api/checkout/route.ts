// /src/app/api/checkout/route.ts

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-07-30.basil",
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // const user = await prisma.user.findUnique({
    //   where: { email: session.user.email },
    // })

    // if (!user?.hasPaid) {

    // }
    const stripeSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: { name: "Accès Premium" },
            unit_amount: 499,
          },
          quantity: 1,
        },
      ],
      metadata: {
        email: session.user.email,
      },
      success_url: `${req.nextUrl.origin}/payment-success`,
      cancel_url: `${req.nextUrl.origin}/paywall`,
    });

    return NextResponse.json({ url: stripeSession.url });
  } catch (err) {
    console.error("Erreur Stripe :", err);
    return NextResponse.json({ error: "Erreur de paiement" }, { status: 500 });
  }
}
