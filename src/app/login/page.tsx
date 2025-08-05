"use client";

import { signIn, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from 'next/link';

export default function LoginPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Redirige l'utilisateur connecté vers la page d'accueil ou premium
  useEffect(() => {
    if (session?.user) {
      router.push("/premium"); // ou '/dashboard'
    }
  }, [session, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const result = await signIn('credentials', {
      redirect: false,
      email,
      password,
    });

    if (result?.error) {
      setError('Email ou mot de passe incorrect.');
    } else {
      router.push('/premium');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6">
      <h1 className="text-3xl font-bold mb-6">Connexion</h1>

      <form onSubmit={handleSubmit} className="w-full max-w-sm mb-4">
        {error && <p className="bg-red-500 text-white p-2 mb-4 rounded">{error}</p>}
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          />
        </div>
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
            Mot de passe
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline"
          />
        </div>
        <div className="flex items-center justify-between">
          <button
            type="submit"
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            Se connecter
          </button>
        </div>
      </form>

      <div className="text-center w-full max-w-sm">
        <p className="text-gray-600 text-sm">Vous n'avez pas de compte? <Link href="/signup" className="text-blue-500 hover:text-blue-700">Inscrivez-vous</Link></p>
        <div className="my-4 flex items-center">
            <div className="flex-grow border-t border-gray-300"></div>
            <span className="flex-shrink mx-4 text-gray-500">Ou</span>
            <div className="flex-grow border-t border-gray-300"></div>
        </div>
      </div>

      <button
        onClick={() => signIn("github")}
        className="mb-4 bg-black text-white px-4 py-2 rounded w-full max-w-sm"
      >
        Se connecter avec GitHub
      </button>

      <button
        onClick={() => signIn("google")}
        className="bg-blue-600 text-white px-4 py-2 rounded w-full max-w-sm"
      >
        Se connecter avec Google
      </button>
    </div>
  );
}
