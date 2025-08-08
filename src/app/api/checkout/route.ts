import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

/**
 * Handles the creation of a Stripe checkout session for premium access.
 *
 * This function verifies if the user is authenticated and has a valid Stripe Customer ID.
 * If authentication fails, it returns a 401 Unauthorized response.
 * If the user or Stripe Customer ID is not found, it returns a 400 response.
 * On success, it creates a Stripe checkout session for a premium access purchase
 * and returns the session ID in the response. 
 * If an error occurs during session creation, it logs the error and returns a 500 response.
 *
 * @param req - The incoming HTTP request object.
 * @returns A NextResponse object containing the Stripe session ID or an error message.
 */

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user || !user.stripeCustomerId) {
    return new NextResponse("User or Stripe Customer ID not found", { status: 400 });
  }

  try {
    const stripeSession = await stripe.checkout.sessions.create({
      customer: user.stripeCustomerId,
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: "Accès Premium",
            },
            unit_amount: 499, // 4.99 EUR
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXTAUTH_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      // NOTE: The CHECKOUT_SESSION_ID is automatically replaced by Stripe with the actual session ID when the user is redirected to the success_url after a successful payment.
      cancel_url: `${process.env.NEXTAUTH_URL}/cancel`,
      metadata: {
        userId: session.user.id,
      },
    });

    return NextResponse.json({ id: stripeSession.id });
  } catch (error) {
    console.error("Stripe checkout session creation failed:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
