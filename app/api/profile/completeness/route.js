import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { computeCompleteness } from "@/lib/metrics/completeness";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const profile = await prisma.profile.findUnique({
      where: { userId: session.user.id },
    });

    const { percent, missing } = computeCompleteness(profile);
    return NextResponse.json({ percent, missing });
  } catch (err) {
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
