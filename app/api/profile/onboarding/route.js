import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { computeOnboardingState } from "@/lib/metrics/onboarding-state";

export const dynamic = "force-dynamic";

// GET /api/profile/onboarding
// Retorna o state das fontes conectadas (CV, LinkedIn, GitHub).
// Segurança: userId vem de auth() — nunca do cliente. Query escopada por dono.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const profile = await prisma.profile.findUnique({
      where: { userId: session.user.id },
    });
    const state = computeOnboardingState(profile);
    return NextResponse.json(state);
  } catch (err) {
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
