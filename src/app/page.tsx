"use client";

import { loadStripe } from "@stripe/stripe-js";
import { useState } from "react";
import Link from "next/link";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY!);

export default function Page() {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    const data = await res.json();

    const stripe = await stripePromise;
    await stripe?.redirectToCheckout({ sessionId: data.id });
    setLoading(false);
  };

  return (
    <main className="p-10 text-center">
      <h1 className="text-2xl font-bold">Accès Premium – 4,99 €</h1>
      <button
        onClick={handleClick}
        disabled={loading}
        className="mt-6 px-4 py-2 bg-blue-600 text-white rounded"
      >
        {loading ? "Redirection..." : "Payer maintenant"}
      </button>
    </main>
  );
}
