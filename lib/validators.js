import { z } from "zod";

// LLMs as vezes erram acento ("Medio") ou caixa ("ALTO") em enums. Normalizamos
// na entrada antes do enum estrito, pra nao derrubar todo o plano por isso.
const Esforco = z.preprocess((v) => {
  const s = String(v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
  if (s.startsWith("baix")) return "Baixo";
  if (s.startsWith("med") || s.startsWith("mod")) return "Médio";
  if (s.startsWith("alt")) return "Alto";
  return v;
}, z.enum(["Baixo", "Médio", "Alto"]));

// Limites: evitam abuso de custo/DoS e ReDoS. CVs reais ficam folgados em 40k chars.
export const AnalyzeBody = z
  .object({
    cv: z.string().min(60).max(40_000),
    role: z.string().min(1).max(160),
  })
  .strict();

const SubScore = z.object({
  valor: z.number().int().min(0).max(100),
  explicacao: z.string().max(500).default(""),
});

export const DiagShape = z.object({
  perfil: z
    .object({
      nome: z.string().max(120).default(""),
      cargo_atual: z.string().max(160).default(""),
      senioridade: z.string().max(60).default(""),
      skills: z.array(z.string().max(60)).max(20).default([]),
    })
    .strip(),
  sub_scores: z.object({
    aderencia_vagas: SubScore,
    relevancia_habilidades: SubScore,
    otimizacao_perfil: SubScore,
    experiencia_mercado: SubScore,
  }),
  gaps: z
    .array(
      z.object({
        habilidade: z.string().max(120),
        porque: z.string().max(500).default(""),
        frequencia: z.string().max(20).default(""),
        microacao: z.string().max(240).default(""),
        impacto: z
          .object({
            dimensao: z.enum([
              "aderencia_vagas",
              "relevancia_habilidades",
              "otimizacao_perfil",
              "experiencia_mercado",
            ]),
            pontos: z.number().int().min(0).max(20),
          })
          .strip(),
      })
    )
    .max(10),
});

export const OppBody = z
  .object({
    snapshotId: z.string().min(1).max(50).optional(),
    role: z.string().min(1).max(160).optional(),
    perfil: z.any().optional(),
    gaps: z.array(z.string().max(120)).max(20).optional(),
    // Filtros opcionais (UI nova /oportunidades). Strings vazias = qualquer.
    // Mantemos as labels da UI ("Júnior"/"Pleno"/"Sênior") — a rota normaliza
    // acento/caixa antes de filtrar.
    seniority: z.string().max(20).optional(),
    model: z.string().max(20).optional(),
    minMatch: z.number().int().min(0).max(100).optional(),
  })
  .strict();

export const PorquesShape = z.object({
  porques: z
    .array(
      z.object({
        id: z.string().max(80),
        porque: z.string().max(500),
      })
    )
    .max(20),
});

export const PlanoShape = z.object({
  plano: z
    .array(
      z.object({
        semana: z.number().int().min(1).max(12),
        foco: z.string().max(160).default(""),
        acoes: z
          .array(
            z.object({
              titulo: z.string().max(200),
              impacto: z.string().max(200).default(""),
              esforco: Esforco.default("Médio"),
            })
          )
          .max(6),
      })
    )
    .max(6),
});

export const OppShape = z.object({
  vagas: z
    .array(
      z.object({
        titulo: z.string().max(160),
        empresa: z.string().max(160),
        local: z.string().max(120).default(""),
        match: z.number().int().min(0).max(100),
        porque: z.string().max(500).default(""),
        falta: z.array(z.string().max(60)).max(8).default([]),
      })
    )
    .max(6),
  plano: z
    .array(
      z.object({
        semana: z.number().int().min(1).max(12),
        foco: z.string().max(160).default(""),
        acoes: z
          .array(
            z.object({
              titulo: z.string().max(200),
              impacto: z.string().max(200).default(""),
              esforco: Esforco.default("Médio"),
            })
          )
          .max(6),
      })
    )
    .max(6),
});

export const InterviewBody = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("question"),
      role: z.string().min(1).max(160),
      gaps: z.array(z.string().max(120)).max(20).default([]),
      asked: z.array(z.string().max(400)).max(50).default([]),
    })
    .strict(),
  z
    .object({
      action: z.literal("evaluate"),
      role: z.string().min(1).max(160),
      pergunta: z.string().min(1).max(800),
      resposta: z.string().min(1).max(8_000),
    })
    .strict(),
]);

export const TailorBody = z
  .object({
    role: z.string().min(1).max(160),
    cv: z.string().min(60).max(40_000),
    vaga: z.object({}).passthrough(),
  })
  .strict();

export const LinkedinParseBody = z
  .object({
    text: z.string().min(120).max(60_000),
  })
  .strict();

export const LinkedinShape = z.object({
  cv_consolidado: z.string().max(40_000),
  perfil: z
    .object({
      nome: z.string().max(160).default(""),
      headline: z.string().max(240).default(""),
      cargo_atual: z.string().max(160).default(""),
      senioridade: z.string().max(60).default(""),
      localidade: z.string().max(160).default(""),
      sobre: z.string().max(3000).default(""),
      experiencias: z
        .array(
          z.object({
            cargo: z.string().max(160),
            empresa: z.string().max(160),
            periodo: z.string().max(80).default(""),
            descricao: z.string().max(2000).default(""),
          })
        )
        .max(20)
        .default([]),
      formacoes: z
        .array(
          z.object({
            instituicao: z.string().max(200),
            curso: z.string().max(200).default(""),
            periodo: z.string().max(80).default(""),
          })
        )
        .max(10)
        .default([]),
      skills: z.array(z.string().max(60)).max(40).default([]),
    })
    .strip(),
});

export const PortfolioImportBody = z
  .object({
    github: z.string().max(80).regex(/^[a-zA-Z0-9._-]{1,80}$/).optional(),
    url: z.string().url().max(400).optional(),
  })
  .strict()
  .refine((d) => d.github || d.url, {
    message: "Informe seu usuário do GitHub OU a URL do seu site/portfólio.",
  });

export const PortfolioShape = z.object({
  resumo: z.string().max(2000).default(""),
  stack: z.array(z.string().max(60)).max(40).default([]),
  projetos: z
    .array(
      z.object({
        nome: z.string().max(160),
        descricao: z.string().max(800).default(""),
        stack: z.array(z.string().max(60)).max(20).default([]),
        url: z.string().max(400).default(""),
        destaque: z.string().max(200).default(""),
      })
    )
    .max(12),
});

export const ApplicationCreateBody = z
  .object({
    titulo: z.string().min(1).max(200),
    empresa: z.string().min(1).max(160),
    local: z.string().max(160).optional(),
    url: z.string().url().max(800).optional(),
    salario: z.string().max(120).optional(),
    source: z.string().max(40).optional(),
    notes: z.string().max(4000).optional(),
    status: z
      .enum(["SAVED", "APPLIED", "SCREENING", "INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN"])
      .default("SAVED"),
  })
  .strict();

export const ApplicationPatchBody = z
  .object({
    status: z
      .enum(["SAVED", "APPLIED", "SCREENING", "INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN"])
      .optional(),
    notes: z.string().max(4000).optional(),
  })
  .strict()
  .refine((d) => d.status !== undefined || d.notes !== undefined, {
    message: "Nada para atualizar — envie um novo status ou anotação.",
  });

export const ChatBody = z
  .object({
    role: z.string().min(1).max(160),
    perfil: z.any().optional(),
    gaps: z.array(z.string().max(120)).max(20).default([]),
    history: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string().max(4_000),
        })
      )
      .max(30)
      .default([]),
    message: z.string().min(1).max(2_000),
  })
  .strict();
