import { z } from "zod";

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
              esforco: z.enum(["Baixo", "Médio", "Alto"]).default("Médio"),
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
              esforco: z.enum(["Baixo", "Médio", "Alto"]).default("Médio"),
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
