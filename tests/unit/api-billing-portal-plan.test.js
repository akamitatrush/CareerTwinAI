// Integration tests pras rotas:
//  - POST /api/billing/portal (Stripe Customer Portal)
//  - GET /api/billing/plan (plano + uso atual)
//
// Cobertura POST /portal:
//  - 503 sem Stripe configurado
//  - 401 sem session
//  - 404 NO_CUSTOMER quando user sem subscription/customerId
//  - 200 retorna { url } do portal
//  - 500 PORTAL_FAILED quando Stripe portal lanca
//
// Cobertura GET /plan:
//  - 401 sem session
//  - 200 retorna { plan, subscription, usage, period }
//  - Substitui Infinity por null no limits (JSON-safe)
//
// Mocks: prisma, stripe, auth, billing.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeReq, makeGetReq } from "../helpers/api.js";

vi.mock("@/lib/db", () => ({
  prisma: {
    subscription: { findUnique: vi.fn() },
    usageMeter: { findMany: vi.fn() },
  },
}));

const mockBillingPortalSessions = { create: vi.fn() };

vi.mock("@/lib/billing/stripe", () => ({
  stripe: vi.fn(() => ({
    billingPortal: { sessions: mockBillingPortalSessions },
  })),
  isStripeConfigured: vi.fn(() => true),
}));

vi.mock("@/lib/billing/enforce", () => ({
  getUserPlan: vi.fn(),
  periodKey: vi.fn(() => "2026-06"),
  dayKey: vi.fn(() => "2026-06-22"),
}));

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isStripeConfigured } from "@/lib/billing/stripe";
import { getUserPlan } from "@/lib/billing/enforce";

describe("POST /api/billing/portal", () => {
  let POST;

  beforeEach(async () => {
    vi.resetModules();
    prisma.subscription.findUnique.mockReset();
    mockBillingPortalSessions.create.mockReset();
    auth.mockReset();
    isStripeConfigured.mockReset();
    isStripeConfigured.mockReturnValue(true);

    const mod = await import("@/app/api/billing/portal/route.js");
    POST = mod.POST;
  });

  it("503 quando Stripe nao configurado", async () => {
    isStripeConfigured.mockReturnValueOnce(false);
    const r = await POST(makeReq({}));
    expect(r.status).toBe(503);
    const data = await r.json();
    expect(data.code).toBe("BILLING_NOT_CONFIGURED");
  });

  it("401 UNAUTHORIZED sem session", async () => {
    auth.mockResolvedValue(null);
    const r = await POST(makeReq({}));
    expect(r.status).toBe(401);
    expect(prisma.subscription.findUnique).not.toHaveBeenCalled();
  });

  it("404 NO_CUSTOMER quando user sem Subscription.stripeCustomerId (free user)", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.subscription.findUnique.mockResolvedValue(null);
    const r = await POST(makeReq({}));
    expect(r.status).toBe(404);
    const data = await r.json();
    expect(data.code).toBe("NO_CUSTOMER");
    expect(mockBillingPortalSessions.create).not.toHaveBeenCalled();
  });

  it("404 NO_CUSTOMER quando subscription existe mas sem stripeCustomerId", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.subscription.findUnique.mockResolvedValue({ stripeCustomerId: null });
    const r = await POST(makeReq({}));
    expect(r.status).toBe(404);
  });

  it("200 retorna { url } do portal escopado pelo customer do user", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.subscription.findUnique.mockResolvedValue({
      stripeCustomerId: "cus_meu",
    });
    mockBillingPortalSessions.create.mockResolvedValue({
      url: "https://billing.stripe.com/portal/abc",
    });
    const r = await POST(makeReq({}));
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.url).toBe("https://billing.stripe.com/portal/abc");
    // Confirma escopo + customer correto.
    expect(prisma.subscription.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u1" } })
    );
    const args = mockBillingPortalSessions.create.mock.calls[0][0];
    expect(args.customer).toBe("cus_meu");
  });

  it("500 PORTAL_FAILED quando Stripe portal lanca", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.subscription.findUnique.mockResolvedValue({
      stripeCustomerId: "cus_x",
    });
    mockBillingPortalSessions.create.mockRejectedValue(new Error("Stripe API down"));
    const r = await POST(makeReq({}));
    expect(r.status).toBe(500);
    const data = await r.json();
    expect(data.code).toBe("PORTAL_FAILED");
    expect(data.error).not.toContain("Stripe API");
  });
});

describe("GET /api/billing/plan", () => {
  let GET;

  beforeEach(async () => {
    vi.resetModules();
    prisma.subscription.findUnique.mockReset();
    prisma.usageMeter.findMany.mockReset();
    auth.mockReset();
    getUserPlan.mockReset();

    const mod = await import("@/app/api/billing/plan/route.js");
    GET = mod.GET;
  });

  it("401 UNAUTHORIZED sem session", async () => {
    auth.mockResolvedValue(null);
    const r = await GET(makeGetReq());
    expect(r.status).toBe(401);
    expect(getUserPlan).not.toHaveBeenCalled();
  });

  it("200 retorna plan, subscription, usage e period", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    getUserPlan.mockResolvedValue({
      id: "free",
      name: "Free",
      priceBRL: 0,
      interval: null,
      limits: { analyze: 10, tailor: 5, opportunities: 20, interview: 10 },
      features: {},
    });
    prisma.subscription.findUnique.mockResolvedValue({
      status: "ACTIVE",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      trialEndsAt: null,
      planId: "free",
    });
    prisma.usageMeter.findMany.mockResolvedValue([
      { feature: "analyze", count: 2, periodKey: "2026-06" },
      { feature: "opportunities", count: 1, periodKey: "2026-06-22" },
    ]);
    const r = await GET(makeGetReq());
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.plan.id).toBe("free");
    expect(data.subscription).toBeDefined();
    expect(data.usage.analyze["2026-06"]).toBe(2);
    expect(data.usage.opportunities["2026-06-22"]).toBe(1);
    expect(data.period.month).toBe("2026-06");
  });

  it("Infinity em limits substituido por null (JSON-safe)", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    getUserPlan.mockResolvedValue({
      id: "pro_monthly",
      name: "Pro",
      priceBRL: 29,
      limits: { analyze: Infinity, tailor: Infinity },
      features: {},
    });
    prisma.subscription.findUnique.mockResolvedValue(null);
    prisma.usageMeter.findMany.mockResolvedValue([]);
    const r = await GET(makeGetReq());
    const data = await r.json();
    // JSON.stringify(Infinity) gera null. Confirma que veio null (nao 0/undefined).
    expect(data.plan.limits.analyze).toBeNull();
    expect(data.plan.limits.tailor).toBeNull();
  });

  it("Query usage com OR mensal + diario", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    getUserPlan.mockResolvedValue({
      id: "free",
      limits: {},
      features: {},
    });
    prisma.subscription.findUnique.mockResolvedValue(null);
    prisma.usageMeter.findMany.mockResolvedValue([]);
    await GET(makeGetReq());
    // Confirma escopo correto + OR por periodKey (anti-IDOR via userId).
    const args = prisma.usageMeter.findMany.mock.calls[0][0];
    expect(args.where.userId).toBe("u1");
    expect(args.where.OR).toEqual([
      { periodKey: "2026-06" },
      { periodKey: "2026-06-22" },
    ]);
  });
});
