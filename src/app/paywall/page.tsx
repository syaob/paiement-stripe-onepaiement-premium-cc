"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY!);

export default function PaywallPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);

  /*************  ✨ Windsurf Command ⭐  *************/
  /**
   * Initiates the payment process by creating a checkout session.
   *
   * This function sets the loading state to true, makes a POST request
   * to the "/api/checkout" endpoint to create a checkout session,
   * retrieves the session ID from the response, and redirects the user
   * to the Stripe checkout page using the session ID. Once the session
   * is created or an error occurs, the loading state is set back to false.
   */

  /*******  8df7cd3d-cc04-4fb0-8508-3e921349a193  *******/
  const handlePayment = async () => {
    setLoading(true);
    const res = await fetch("/api/checkout", { method: "POST" });
    const data = await res.json();

    const stripe = await stripePromise;
    await stripe?.redirectToCheckout({ sessionId: data.id });
    setLoading(false);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center text-center p-6">
      <h1 className="text-3xl font-bold mb-4 text-red-600">Accès restreint</h1>
      <p className="mb-6 text-gray-700">
        Cette section est réservée aux membres ayant souscrit à l’offre Premium.
      </p>

      <button
        onClick={handlePayment}
        className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition"
        disabled={loading}
      >
        {loading ? "Redirection..." : "Passer à Premium – 4,99 €"}
      </button>

      <button
        className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition mt-4"
        onClick={() => router.push("/")}
      >
        Retour à l’accueil
      </button>

      <p className="mt-6 text-sm text-gray-500">
        Déjà membre Premium ?{" "}
        <span
          onClick={() => signIn()}
          className="text-blue-600 underline cursor-pointer"
        >
          Connectez-vous
        </span>
      </p>
    </main>
  );
}
