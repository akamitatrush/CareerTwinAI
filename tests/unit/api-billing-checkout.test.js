// Integration tests da rota POST /api/billing/checkout.
//
// Cobertura:
//  - 503 BILLING_NOT_CONFIGURED quando STRIPE_SECRET_KEY ausente
//  - 401 UNAUTHORIZED sem session
//  - 400 BAD_JSON / INVALID_PLAN (plano nao existe, ou "free")
//  - 500 CUSTOMER_FAILED quando criacao do customer lanca
//  - 500 CHECKOUT_FAILED quando criacao do checkout lanca
//  - 200 retorna { url } do checkout
//  - Reutiliza customer existente (nao cria duplicado)
//  - Metadata.userId vem da SESSION, nao do body (anti IDOR de billing)
//
// Mocks: prisma, stripe, auth.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeReq } from "../helpers/api.js";

vi.mock("@/lib/db", () => ({
  prisma: {
    subscription: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}));

const mockCustomers = { create: vi.fn() };
const mockCheckoutSessions = { create: vi.fn() };

vi.mock("@/lib/billing/stripe", () => ({
  stripe: vi.fn(() => ({
    customers: mockCustomers,
    checkout: { sessions: mockCheckoutSessions },
  })),
  isStripeConfigured: vi.fn(() => true),
}));

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isStripeConfigured } from "@/lib/billing/stripe";

let POST;

beforeEach(async () => {
  vi.resetModules();
  prisma.subscription.findUnique.mockReset();
  prisma.subscription.upsert.mockReset();
  mockCustomers.create.mockReset();
  mockCheckoutSessions.create.mockReset();
  auth.mockReset();
  isStripeConfigured.mockReset();
  isStripeConfigured.mockReturnValue(true);

  const mod = await import("@/app/api/billing/checkout/route.js");
  POST = mod.POST;
});

describe("POST /api/billing/checkout — gates basicos", () => {
  it("503 BILLING_NOT_CONFIGURED quando Stripe nao configurado", async () => {
    isStripeConfigured.mockReturnValueOnce(false);
    const r = await POST(makeReq({ planId: "pro_monthly" }));
    expect(r.status).toBe(503);
    const data = await r.json();
    expect(data.code).toBe("BILLING_NOT_CONFIGURED");
    expect(auth).not.toHaveBeenCalled();
  });

  it("401 UNAUTHORIZED sem session", async () => {
    auth.mockResolvedValue(null);
    const r = await POST(makeReq({ planId: "pro_monthly" }));
    expect(r.status).toBe(401);
    const data = await r.json();
    expect(data.code).toBe("UNAUTHORIZED");
    expect(prisma.subscription.findUnique).not.toHaveBeenCalled();
  });

  it("401 UNAUTHORIZED sem email na session", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } }); // sem email
    const r = await POST(makeReq({ planId: "pro_monthly" }));
    expect(r.status).toBe(401);
  });
});

describe("POST /api/billing/checkout — input validation", () => {
  it("400 BAD_JSON com body invalido", async () => {
    auth.mockResolvedValue({ user: { id: "u1", email: "a@b.com" } });
    const req = new Request("http://test.local/api/billing/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not-json",
    });
    const r = await POST(req);
    expect(r.status).toBe(400);
    const data = await r.json();
    expect(data.code).toBe("BAD_JSON");
  });

  it("400 INVALID_PLAN quando planId='free' (proibido explicitamente)", async () => {
    auth.mockResolvedValue({ user: { id: "u1", email: "a@b.com" } });
    const r = await POST(makeReq({ planId: "free" }));
    expect(r.status).toBe(400);
    const data = await r.json();
    expect(data.code).toBe("INVALID_PLAN");
  });

  it("400 INVALID_PLAN quando planId inexistente (fail closed via getPlan->free)", async () => {
    auth.mockResolvedValue({ user: { id: "u1", email: "a@b.com" } });
    const r = await POST(makeReq({ planId: "nonexistent_plan_xyz" }));
    expect(r.status).toBe(400);
    const data = await r.json();
    expect(data.code).toBe("INVALID_PLAN");
  });

  it("400 INVALID_PLAN quando planId vazio", async () => {
    auth.mockResolvedValue({ user: { id: "u1", email: "a@b.com" } });
    const r = await POST(makeReq({ planId: "" }));
    expect(r.status).toBe(400);
    const data = await r.json();
    expect(data.code).toBe("INVALID_PLAN");
  });
});

describe("POST /api/billing/checkout — customer setup", () => {
  it("reutiliza customer existente (NAO cria novo)", async () => {
    auth.mockResolvedValue({ user: { id: "u1", email: "a@b.com" } });
    prisma.subscription.findUnique.mockResolvedValue({
      stripeCustomerId: "cus_existing",
    });
    mockCheckoutSessions.create.mockResolvedValue({
      url: "https://checkout.stripe.com/c/123",
    });
    const r = await POST(makeReq({ planId: "pro_monthly" }));
    expect(r.status).toBe(200);
    // Customer NAO criado de novo.
    expect(mockCustomers.create).not.toHaveBeenCalled();
    // Subscription NAO upsert de novo.
    expect(prisma.subscription.upsert).not.toHaveBeenCalled();
    // Checkout usa customer existente.
    const args = mockCheckoutSessions.create.mock.calls[0][0];
    expect(args.customer).toBe("cus_existing");
  });

  it("cria customer novo + Subscription INCOMPLETE quando user sem assinatura", async () => {
    auth.mockResolvedValue({ user: { id: "u1", email: "a@b.com" } });
    prisma.subscription.findUnique.mockResolvedValue(null);
    mockCustomers.create.mockResolvedValue({ id: "cus_new" });
    mockCheckoutSessions.create.mockResolvedValue({
      url: "https://checkout.stripe.com/c/123",
    });
    const r = await POST(makeReq({ planId: "pro_monthly" }));
    expect(r.status).toBe(200);
    expect(mockCustomers.create).toHaveBeenCalledWith({
      email: "a@b.com",
      metadata: { userId: "u1" }, // userId da session, nao do body
    });
    expect(prisma.subscription.upsert).toHaveBeenCalledTimes(1);
    const upsertArgs = prisma.subscription.upsert.mock.calls[0][0];
    expect(upsertArgs.create.userId).toBe("u1");
    expect(upsertArgs.create.stripeCustomerId).toBe("cus_new");
    expect(upsertArgs.create.status).toBe("INCOMPLETE");
  });

  it("500 CUSTOMER_FAILED quando setup do customer lanca", async () => {
    auth.mockResolvedValue({ user: { id: "u1", email: "a@b.com" } });
    prisma.subscription.findUnique.mockResolvedValue(null);
    mockCustomers.create.mockRejectedValue(new Error("Stripe API down"));
    const r = await POST(makeReq({ planId: "pro_monthly" }));
    expect(r.status).toBe(500);
    const data = await r.json();
    expect(data.code).toBe("CUSTOMER_FAILED");
    expect(data.error).not.toContain("Stripe API");
  });
});

describe("POST /api/billing/checkout — happy path", () => {
  it("200 retorna { url } do checkout com metadata.userId da SESSION", async () => {
    auth.mockResolvedValue({ user: { id: "u1", email: "a@b.com" } });
    prisma.subscription.findUnique.mockResolvedValue({ stripeCustomerId: "cus_x" });
    mockCheckoutSessions.create.mockResolvedValue({
      url: "https://checkout.stripe.com/c/cs_test_123",
    });
    // Body tenta forjar userId que NAO deve ser usado.
    const r = await POST(
      makeReq({ planId: "pro_monthly", userId: "hacker-trying-buy-for-other-user" })
    );
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.url).toBe("https://checkout.stripe.com/c/cs_test_123");
    // Metadata vem da session.
    const args = mockCheckoutSessions.create.mock.calls[0][0];
    expect(args.metadata.userId).toBe("u1");
    expect(args.subscription_data.metadata.userId).toBe("u1");
    expect(args.metadata.planId).toBe("pro_monthly");
  });

  it("500 CHECKOUT_FAILED quando Stripe checkout.create lanca", async () => {
    auth.mockResolvedValue({ user: { id: "u1", email: "a@b.com" } });
    prisma.subscription.findUnique.mockResolvedValue({ stripeCustomerId: "cus_x" });
    mockCheckoutSessions.create.mockRejectedValue(new Error("Stripe rejected"));
    const r = await POST(makeReq({ planId: "pro_monthly" }));
    expect(r.status).toBe(500);
    const data = await r.json();
    expect(data.code).toBe("CHECKOUT_FAILED");
    expect(data.error).not.toContain("Stripe rejected");
  });

  it("origin do checkout vem do req.url (defesa contra deploy errado)", async () => {
    auth.mockResolvedValue({ user: { id: "u1", email: "a@b.com" } });
    prisma.subscription.findUnique.mockResolvedValue({ stripeCustomerId: "cus_x" });
    mockCheckoutSessions.create.mockResolvedValue({ url: "https://x.test" });
    const req = new Request("https://my-deploy.vercel.app/api/billing/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ planId: "pro_monthly" }),
    });
    await POST(req);
    const args = mockCheckoutSessions.create.mock.calls[0][0];
    expect(args.success_url).toContain("https://my-deploy.vercel.app");
    expect(args.cancel_url).toContain("https://my-deploy.vercel.app");
  });
});
