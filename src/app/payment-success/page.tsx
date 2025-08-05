import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function PaymentSuccessPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/login");
  }

  // Update dans la DB
  await prisma.user.update({
    where: { email: session.user.email },
    data: { hasPaid: true },
  });

  redirect("/premium");
}
