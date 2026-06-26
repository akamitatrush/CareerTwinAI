// Helpers compartilhados pelos tests de integracao das API routes.
//
// Politica:
//  - makeReq/makeGetReq devolvem Request standard (Next 14 App Router usa Web
//    Standard Request, nao NextRequest, no .json()/.text()).
//  - mockPrisma cria um mock plano com todos os models do schema relevantes pra
//    rotas. Cada test ainda pode sobrescrever fns individuais com .mockResolvedValue.
//  - setupAuthSession monta o shape esperado por auth() do Auth.js (apenas
//    user.id + email — id e o que rotas usam pra IDOR scope).
//
// IMPORTANTE: Esse arquivo NAO importa nada de @/ pra evitar acoplar tests aos
// modulos reais. Mocks dos modulos sao injetados em cada test via vi.mock.

import { vi } from "vitest";

export function makeReq(body = {}, headers = {}, url = "http://test.local/api/x") {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

export function makeGetReq(headers = {}, url = "http://test.local/api/x") {
  return new Request(url, { method: "GET", headers });
}

export function makeDeleteReq(headers = {}, url = "http://test.local/api/x") {
  return new Request(url, { method: "DELETE", headers });
}

// Construtor da sessao tipica do Auth.js. user.id e o unico campo critico pro
// IDOR scope nas rotas. email/name sao pra cosmetica.
export function setupAuthSession(userId = "u1", overrides = {}) {
  return {
    user: { id: userId, email: "test@test.com", name: "Test User", ...overrides },
  };
}

// Mock do prisma com todos os models que aparecem nas rotas testadas.
// $transaction default: chama callback com o proprio mock como tx (mimica Serializable).
export function mockPrisma() {
  const mock = {
    profile: {
      findUnique: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    scoreSnapshot: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    gap: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
    },
    evidence: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    assessmentResult: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      groupBy: vi.fn(),
    },
    application: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    notification: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    usageMeter: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      findMany: vi.fn(),
      aggregate: vi.fn(),
    },
    billingEvent: {
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    knowledgeChunk: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    consent: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    dataSource: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    tailoredCv: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    planItem: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $queryRawUnsafe: vi.fn(),
    $executeRaw: vi.fn(),
  };
  // $transaction recebe callback ou array. Default: roda callback passando o
  // proprio mock; pra array, faz Promise.all.
  mock.$transaction = vi.fn(async (cb) => {
    if (typeof cb === "function") return await cb(mock);
    return await Promise.all(cb);
  });
  return mock;
}

// Reseta TODOS os mocks de um prisma criado por mockPrisma().
// Reposiciona $transaction com a impl default (callback / array).
export function resetPrisma(prisma) {
  for (const v of Object.values(prisma)) {
    if (typeof v === "object" && v !== null) {
      for (const f of Object.values(v)) {
        if (typeof f === "function" && typeof f.mockReset === "function") {
          f.mockReset();
        }
      }
    }
  }
  if (prisma.$transaction?.mockReset) {
    prisma.$transaction.mockReset();
    prisma.$transaction.mockImplementation(async (cb) => {
      if (typeof cb === "function") return await cb(prisma);
      return await Promise.all(cb);
    });
  }
  if (prisma.$queryRaw?.mockReset) prisma.$queryRaw.mockReset();
  if (prisma.$queryRawUnsafe?.mockReset) prisma.$queryRawUnsafe.mockReset();
  if (prisma.$executeRaw?.mockReset) prisma.$executeRaw.mockReset();
}
