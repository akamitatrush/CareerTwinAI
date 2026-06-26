// Integration tests da rota POST /api/billing/webhook.
//
// Cobertura:
//  - 503 sem Stripe configurado / STRIPE_WEBHOOK_SECRET ausente
//  - 400 sem cabeca stripe-signature
//  - 400 signature invalida (mock constructEvent throw + audit SECURITY_INVALID_WEBHOOK)
//  - 200 idempotente: P2002 (BillingEvent.stripeEventId UNIQUE) => duplicate:true
//  - 500 quando log do BillingEvent falha por outro motivo
//  - checkout.session.completed: cria/atualiza Subscription ACTIVE + audit
//  - customer.subscription.deleted: marca CANCELED + audit
//  - invoice.payment_failed: audita BILLING_PAYMENT_FAILED
//  - 500 quando handler especifico lanca (Stripe retry)
//  - userId vem do metadata, NAO de input nao confiavel
//
// Mocks: prisma, stripe, audit.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    billingEvent: { create: vi.fn() },
    subscription: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
  },
}));

const mockConstructEvent = vi.fn();

vi.mock("@/lib/billing/stripe", () => ({
  stripe: vi.fn(() => ({
    webhooks: { constructEvent: mockConstructEvent },
  })),
  isStripeConfigured: vi.fn(() => true),
}));

vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined) }));

import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { isStripeConfigured } from "@/lib/billing/stripe";

function makeWebhookReq(rawBody = "{}", sig = "sig_test") {
  return new Request("http://test.local/api/billing/webhook", {
    method: "POST",
    headers: sig
      ? {
          "content-type": "application/json",
          "stripe-signature": sig,
        }
      : { "content-type": "application/json" },
    body: rawBody,
  });
}

let POST;

beforeEach(async () => {
  vi.resetModules();
  prisma.billingEvent.create.mockReset();
  prisma.subscription.findUnique.mockReset();
  prisma.subscription.upsert.mockReset();
  prisma.subscription.update.mockReset();
  mockConstructEvent.mockReset();
  audit.mockReset();
  isStripeConfigured.mockReset();
  isStripeConfigured.mockReturnValue(true);

  // Default: STRIPE_WEBHOOK_SECRET disponivel pros tests.
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";

  const mod = await import("@/app/api/billing/webhook/route.js");
  POST = mod.POST;
});

describe("POST /api/billing/webhook — gates basicos", () => {
  it("503 quando Stripe nao configurado", async () => {
    isStripeConfigured.mockReturnValueOnce(false);
    const r = await POST(makeWebhookReq());
    expect(r.status).toBe(503);
  });

  it("503 quando STRIPE_WEBHOOK_SECRET ausente", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const r = await POST(makeWebhookReq());
    expect(r.status).toBe(503);
    expect(mockConstructEvent).not.toHaveBeenCalled();
  });

  it("400 quando header stripe-signature ausente", async () => {
    const r = await POST(makeWebhookReq("{}", null));
    expect(r.status).toBe(400);
    const data = await r.json();
    expect(data.error).toBe("no_signature");
  });

  it("400 + audit SECURITY_INVALID_WEBHOOK quando signature invalida", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("signature mismatch");
    });
    const r = await POST(makeWebhookReq("{}", "bad_sig"));
    expect(r.status).toBe(400);
    // Audit critico foi gravado pro forense.
    expect(audit).toHaveBeenCalledTimes(1);
    const call = audit.mock.calls[0][0];
    expect(call.action).toBe("SECURITY_INVALID_WEBHOOK");
    expect(call.meta.reason).toBe("stripe_signature_invalid");
  });
});

describe("POST /api/billing/webhook — idempotencia", () => {
  it("200 duplicate:true quando BillingEvent ja existe (P2002)", async () => {
    mockConstructEvent.mockReturnValue({
      id: "evt_1",
      type: "checkout.session.completed",
      data: { object: { metadata: { userId: "u1" } } },
    });
    const p2002 = new Error("Unique constraint failed");
    p2002.code = "P2002";
    prisma.billingEvent.create.mockRejectedValue(p2002);
    const r = await POST(makeWebhookReq());
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.duplicate).toBe(true);
    // Handler nem deveria rodar — subscription nao toca.
    expect(prisma.subscription.upsert).not.toHaveBeenCalled();
  });

  it("500 quando BillingEvent.create falha por outro motivo (nao P2002)", async () => {
    mockConstructEvent.mockReturnValue({
      id: "evt_1",
      type: "checkout.session.completed",
      data: { object: { metadata: { userId: "u1" } } },
    });
    prisma.billingEvent.create.mockRejectedValue(new Error("DB pool exhausted"));
    const r = await POST(makeWebhookReq());
    expect(r.status).toBe(500);
  });

  it("BillingEvent.create chamado com userId do metadata + stripeEventId", async () => {
    mockConstructEvent.mockReturnValue({
      id: "evt_42",
      type: "checkout.session.completed",
      data: { object: { metadata: { userId: "u1" } } },
    });
    prisma.billingEvent.create.mockResolvedValue({});
    prisma.subscription.upsert.mockResolvedValue({});
    await POST(makeWebhookReq());
    const args = prisma.billingEvent.create.mock.calls[0][0];
    expect(args.data.userId).toBe("u1");
    expect(args.data.stripeEventId).toBe("evt_42");
    expect(args.data.type).toBe("checkout.session.completed");
  });
});

describe("POST /api/billing/webhook — handlers", () => {
  it("checkout.session.completed: upsert Subscription ACTIVE + audit BILLING_SUBSCRIPTION_CREATED", async () => {
    mockConstructEvent.mockReturnValue({
      id: "evt_co",
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { userId: "u1", planId: "pro_monthly" },
          subscription: "sub_123",
          customer: "cus_123",
        },
      },
    });
    prisma.billingEvent.create.mockResolvedValue({});
    prisma.subscription.upsert.mockResolvedValue({});
    const r = await POST(makeWebhookReq());
    expect(r.status).toBe(200);
    const upsertArgs = prisma.subscription.upsert.mock.calls[0][0];
    expect(upsertArgs.where).toEqual({ userId: "u1" });
    expect(upsertArgs.update.status).toBe("ACTIVE");
    expect(upsertArgs.update.stripeSubscriptionId).toBe("sub_123");
    expect(upsertArgs.update.planId).toBe("pro_monthly");
    // Audit chamado.
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        action: "BILLING_SUBSCRIPTION_CREATED",
      })
    );
  });

  it("customer.subscription.deleted: marca CANCELED + planId=free", async () => {
    mockConstructEvent.mockReturnValue({
      id: "evt_del",
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_123", metadata: { userId: "u1" } } },
    });
    prisma.billingEvent.create.mockResolvedValue({});
    prisma.subscription.findUnique.mockResolvedValue({ userId: "u1" });
    prisma.subscription.update.mockResolvedValue({});
    const r = await POST(makeWebhookReq());
    expect(r.status).toBe(200);
    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: "sub_123" },
      data: {
        status: "CANCELED",
        planId: "free",
        cancelAtPeriodEnd: false,
      },
    });
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "BILLING_SUBSCRIPTION_CANCELED" })
    );
  });

  it("invoice.payment_failed: audita BILLING_PAYMENT_FAILED", async () => {
    mockConstructEvent.mockReturnValue({
      id: "evt_pf",
      type: "invoice.payment_failed",
      data: { object: { id: "in_123", metadata: { userId: "u1" } } },
    });
    prisma.billingEvent.create.mockResolvedValue({});
    const r = await POST(makeWebhookReq());
    expect(r.status).toBe(200);
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "BILLING_PAYMENT_FAILED" })
    );
  });

  it("evento nao tratado: 200 sem aplicar efeito (mas BillingEvent gravado)", async () => {
    mockConstructEvent.mockReturnValue({
      id: "evt_unknown",
      type: "some.other.event",
      data: { object: { metadata: {} } },
    });
    prisma.billingEvent.create.mockResolvedValue({});
    const r = await POST(makeWebhookReq());
    expect(r.status).toBe(200);
    expect(prisma.subscription.upsert).not.toHaveBeenCalled();
    // Mas audit nao foi chamado pra eventos nao mapeados.
    expect(audit).not.toHaveBeenCalled();
  });

  it("500 quando handler especifico lanca (pra Stripe retentar)", async () => {
    mockConstructEvent.mockReturnValue({
      id: "evt_co_fail",
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { userId: "u1", planId: "pro_monthly" },
          subscription: "sub_x",
        },
      },
    });
    prisma.billingEvent.create.mockResolvedValue({});
    prisma.subscription.upsert.mockRejectedValue(new Error("DB busy"));
    const r = await POST(makeWebhookReq());
    expect(r.status).toBe(500);
  });
});
