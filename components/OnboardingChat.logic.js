// Logica pura do onboarding conversacional. Fica num arquivo separado
// (sem JSX) pra ser importavel diretamente em vitest com env=node, sem
// precisar de @vitejs/plugin-react. O componente React (OnboardingChat.js)
// importa daqui — uma fonte da verdade.

export const QUESTIONS = [
  {
    id: "name",
    text: "Pra começar, qual o seu nome?",
    placeholder: "Maria Silva",
    inputType: "text",
    required: true,
  },
  {
    id: "currentRole",
    text: "Qual é o seu cargo atual?",
    placeholder: "Ex: Desenvolvedora Backend Pleno",
    inputType: "text",
    required: true,
  },
  {
    id: "years",
    text: "Quantos anos de experiência você tem?",
    placeholder: "Ex: 5",
    inputType: "text",
    required: true,
  },
  {
    id: "skills",
    text: "Quais 5-8 habilidades técnicas você usa mais? (separa por vírgula)",
    placeholder: "Python, SQL, AWS, Docker, React",
    inputType: "text",
    required: true,
  },
  {
    id: "achievements",
    text: "Conta brevemente 2-3 conquistas das suas experiências (com números se tiver)",
    placeholder:
      "Reduzi tempo de query em 60%, liderei migração que economizou R$ 200k...",
    inputType: "textarea",
    required: true,
  },
  {
    id: "education",
    text: "Sua formação acadêmica (graduação + cursos relevantes)?",
    placeholder: "Bacharel em CC pela USP, Bootcamp Tera 2024...",
    inputType: "textarea",
    required: false,
  },
];

// Monta CV em texto plano a partir das respostas. Cada bloco vira uma
// secao "SECAO:\nconteudo". Vazios sao pulados (campos nao-obrigatorios).
// Defende contra null/undefined porque chamamos isso no submit final do
// componente e nao queremos derrubar o fluxo por estado parcial.
export function buildCv(a) {
  if (!a || typeof a !== "object") return "";
  const lines = [];
  if (a.name && a.name.trim()) lines.push(a.name.trim());
  if (a.currentRole && a.currentRole.trim()) lines.push(a.currentRole.trim());
  if (a.years && a.years.trim()) lines.push(`${a.years.trim()} anos de experiência`);
  if (a.skills && a.skills.trim()) {
    lines.push("");
    lines.push(`HABILIDADES:\n${a.skills.trim()}`);
  }
  if (a.achievements && a.achievements.trim()) {
    lines.push("");
    lines.push(`CONQUISTAS:\n${a.achievements.trim()}`);
  }
  if (a.education && a.education.trim()) {
    lines.push("");
    lines.push(`FORMAÇÃO:\n${a.education.trim()}`);
  }
  return lines.join("\n");
}
