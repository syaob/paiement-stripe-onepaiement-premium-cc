import { PrismaClient } from '@/generated/prisma';
import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ message: 'Veuillez fournir tous les champs.' }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json({ message: 'Cet utilisateur existe déjà.' }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        hashedPassword,
      },
    });

    return NextResponse.json({ message: 'Utilisateur créé avec succès.' }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: 'Erreur interne du serveur.' }, { status: 500 });
  }
}
