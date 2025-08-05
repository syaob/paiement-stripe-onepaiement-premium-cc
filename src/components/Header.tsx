"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";

const Header = () => {
  const { data: session } = useSession();

  return (
    <header className="bg-gray-800 text-white p-4">
      <nav className="container mx-auto flex justify-between items-center">
        <Link href="/" className="text-xl font-bold">
          MonApp
        </Link>
        <ul className="flex items-center space-x-4">
          <li>
            <Link href="/">Accueil</Link>
          </li>
          {session?.user ? (
            <>
              <li>
                <Link href="/premium">Premium</Link>
              </li>
              <li className="flex items-center space-x-2">
                <span>{session.user.name || session.user.email}</span>
                <button
                  onClick={() => signOut()}
                  className="bg-red-500 hover:bg-red-600 px-3 py-1 rounded"
                >
                  Déconnexion
                </button>
              </li>
            </>
          ) : (
            <li>
              <button
                onClick={() => signIn()}
                className="bg-blue-500 hover:bg-blue-600 px-3 py-1 rounded"
              >
                Connexion
              </button>
            </li>
          )}
        </ul>
      </nav>
    </header>
  );
};

export default Header;
