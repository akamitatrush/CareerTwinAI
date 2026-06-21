// Provider de fallback: gera vagas ILUSTRATIVAS deterministicas a partir do role.
// Sempre marcado como source: "fixtures" → a UI mostra o chip "Ilustrativo".
// Nao usa empresas reais; nomes ficticios plausiveis.

const FICTICIAS = [
  { empresa: "Acme do Brasil", local: "São Paulo, SP (Híbrido)" },
  { empresa: "Norte Tecnologia", local: "Remoto (Brasil)" },
  { empresa: "Estúdio Caju", local: "Rio de Janeiro, RJ" },
  { empresa: "Banco Andorinha", local: "São Paulo, SP" },
  { empresa: "Cooperativa Verde", local: "Curitiba, PR" },
];

const SENIORIDADES = ["Pleno", "Sênior", "Especialista"];

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export async function searchFixtures({ role, limit = 3 }) {
  const seed = hashStr(role || "x");
  const out = [];
  for (let i = 0; i < limit && i < FICTICIAS.length; i++) {
    const empresa = FICTICIAS[(seed + i) % FICTICIAS.length];
    const sen = SENIORIDADES[(seed + i) % SENIORIDADES.length];
    out.push({
      id: `fix-${i}-${seed}`,
      source: "fixtures",
      titulo: `${role} ${sen}`,
      empresa: empresa.empresa,
      local: empresa.local,
      url: null,
      descricao: `Vaga ILUSTRATIVA para "${role}". Em produção, esta posição viria de uma fonte real (Adzuna, Jooble ou ATS).`,
      salario: null,
      postedAt: null,
    });
  }
  return out;
}
