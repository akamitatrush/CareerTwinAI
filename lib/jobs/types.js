// Forma canonica de uma vaga normalizada.
// Cada provider devolve nesse formato; o resto do app nao precisa saber a fonte
// (excecao: o campo `source` e mostrado no chip da UI e usado pelo guard ilustrativo).
//
// {
//   id: string,            // estavel dentro do provider
//   source: "adzuna" | "jooble" | "greenhouse" | "fixtures",
//   titulo: string,
//   empresa: string,
//   local: string,
//   url: string | null,    // link para a vaga real (null em fixtures)
//   descricao: string,     // texto bruto para extracao de skills (truncado)
//   salario: string | null,
//   postedAt: string | null, // ISO 8601
// }

export const SOURCES = ["adzuna", "jooble", "greenhouse", "fixtures"];

export function isJob(j) {
  return (
    j &&
    typeof j.id === "string" &&
    SOURCES.includes(j.source) &&
    typeof j.titulo === "string" &&
    typeof j.empresa === "string"
  );
}
