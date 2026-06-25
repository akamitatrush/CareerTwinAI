// Tests do provider lib/concursos.
//
// Cobertura:
//  1. parsePciHtml extrai concursos com schema completo de HTML valido.
//  2. fetchConcursos com uf= hita a URL da regiao certa (mock fetch).
//  3. fetchConcursos com nivel filtra por alias correto (medio/superior/etc).
//  4. fetchConcursos com erro 500 retorna [].
//  5. fetchConcursos respeita robots.txt Disallow.
//  6. Cache hit: 2a chamada com mesma chave NAO refaz fetch.
//  7. isValidConcurso dropa entries com campos faltantes.
//  8. Limit respeitado e datas parseadas corretamente.
//
// Mocks: fetch global; cache via cacheClear entre testes.

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchConcursos,
  parsePciHtml,
  isValidConcurso,
  _resetRobotsCache,
} from "@/lib/concursos";
import { cacheClear } from "@/lib/jobs/cache";

// HTML representativo de UMA pagina do pciconcursos com 3 concursos diferentes.
// Inclui marcador <div id="UF" class="ua"> e os blocos com classes na/da/ea.
const SAMPLE_HTML = `
<html><body>
<div id="conteudo">
<h2>NACIONAL</h2><div id="NACIONAL" class="ua"><div class="uf">NACIONAL</div></div>
<div class="na" onclick="myClick(event)" data-url="https://www.pciconcursos.com.br/noticias/inss-concurso-2026" style="cursor:pointer;">
<div class="ca"><a href="https://www.pciconcursos.com.br/noticias/inss-concurso-2026" title="INSS abre concurso">INSS - Instituto Nacional do Seguro Social</a></div>
<div class="cb"><img src="data:image/png;base64,XYZ"></div>
<div class="cc"></div>
<div class="cd">500 vagas até R$ 5.905,79<br><span>Técnico do Seguro Social<br><span>Médio</span></span>
</div><div class="ce"><span>30/07/2026</span></div>
<div class="clear"></div></div>
<div id="SP" class="ua"><div class="uf">SÃO PAULO</div></div>
<div class="da" onclick="myClick(event)" data-url="https://www.pciconcursos.com.br/noticias/tj-sp-2026" style="cursor:pointer;">
<div class="ca"><a href="https://www.pciconcursos.com.br/noticias/tj-sp-2026" title="TJ-SP">TJ-SP - Tribunal de Justiça de São Paulo</a></div>
<div class="cc">SP</div>
<div class="cd">120 vagas de R$ 8.000,00 a R$ 15.000,00<br><span>Analista Judiciário<br><span>Superior</span></span>
</div><div class="ce"><span>15 a 22/08/2026</span></div>
<div class="clear"></div></div>
<div class="ea" onclick="myClick(event)" data-url="https://www.pciconcursos.com.br/noticias/pm-sp-soldado" style="cursor:pointer;">
<div class="ca"><a href="https://www.pciconcursos.com.br/noticias/pm-sp-soldado" title="PM-SP">PM-SP - Polícia Militar de São Paulo</a></div>
<div class="cc">SP</div>
<div class="cd">2.000 vagas<br><span>Aluno-Soldado<br><span>Médio</span></span>
</div><div class="ce"><span>10/09/2026</span></div>
<div class="clear"></div></div>
</div>
</body></html>
`;

// robots.txt amigavel: nao bloqueia /concursos/
const ROBOTS_OK = `User-agent: *
Allow: /
Disallow: /admin/
`;

// robots.txt hostil: bloqueia /concursos
const ROBOTS_BLOCKED = `User-agent: *
Disallow: /concursos
`;

// Helper: monta um mock fetch que devolve robots ou HTML conforme a URL.
function setupFetchMock({ html = SAMPLE_HTML, status = 200, robots = ROBOTS_OK } = {}) {
  globalThis.fetch = vi.fn(async (url) => {
    const u = String(url);
    if (u.endsWith("/robots.txt")) {
      return {
        ok: true,
        status: 200,
        text: async () => robots,
      };
    }
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => html,
    };
  });
}

describe("lib/concursos — parsePciHtml", () => {
  it("extrai concursos com schema completo de HTML valido", () => {
    const items = parsePciHtml(SAMPLE_HTML);
    expect(items).toHaveLength(3);

    const inss = items.find((i) => i.orgao.includes("INSS"));
    expect(inss).toBeDefined();
    expect(inss.cargo).toContain("Técnico do Seguro Social");
    expect(inss.nivel).toBe("Médio");
    expect(inss.vagas).toBe(500);
    expect(inss.salarioMax).toBe(5905.79);
    expect(inss.inscricoesAte).toBeInstanceOf(Date);

    const tj = items.find((i) => i.orgao.includes("TJ-SP"));
    expect(tj).toBeDefined();
    expect(tj.uf).toBe("SP");
    expect(tj.nivel).toBe("Superior");
    expect(tj.salarioMin).toBe(8000);
    expect(tj.salarioMax).toBe(15000);
    // "15 a 22/08/2026" — usa o DD final (22)
    expect(tj.inscricoesAte.getUTCDate()).toBe(22);
    expect(tj.inscricoesAte.getUTCMonth()).toBe(7); // agosto = 7

    // Concurso da PM-SP sem salário (so vagas)
    const pm = items.find((i) => i.orgao.includes("PM-SP"));
    expect(pm.vagas).toBe(2000);
    expect(pm.salarioMin).toBeNull();
    expect(pm.salarioMax).toBeNull();
  });

  it("retorna [] pra HTML vazio ou invalido", () => {
    expect(parsePciHtml("")).toEqual([]);
    expect(parsePciHtml("<html>nothing</html>")).toEqual([]);
    expect(parsePciHtml(null)).toEqual([]);
  });
});

describe("lib/concursos — isValidConcurso", () => {
  it("dropa entries sem id, orgao ou url valida", () => {
    expect(isValidConcurso(null)).toBe(false);
    expect(isValidConcurso({})).toBe(false);
    expect(isValidConcurso({ id: "x", orgao: "X", url: "not-http" })).toBe(false);
    expect(isValidConcurso({ id: "", orgao: "X", url: "https://x.com" })).toBe(false);
    expect(isValidConcurso({ id: "x", orgao: "", url: "https://x.com" })).toBe(false);
    expect(isValidConcurso({ id: "x", orgao: "X", url: "https://x.com" })).toBe(true);
  });
});

describe("lib/concursos — fetchConcursos", () => {
  beforeEach(() => {
    cacheClear();
    _resetRobotsCache();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it("hita /concursos/sudeste/ quando uf=SP", async () => {
    setupFetchMock();
    await fetchConcursos({ uf: "SP" });
    // 1a chamada e robots.txt; 2a e o HTML da regiao.
    const calls = globalThis.fetch.mock.calls.map((c) => String(c[0]));
    expect(calls.some((u) => u.includes("/robots.txt"))).toBe(true);
    expect(calls.some((u) => u.includes("/concursos/sudeste/"))).toBe(true);
  });

  it("filtra por nivel='superior' descartando entries com nivel 'Médio'", async () => {
    setupFetchMock();
    const items = await fetchConcursos({ nivel: "superior" });
    // Apenas TJ-SP é "Superior"; INSS e PM são "Médio".
    expect(items.length).toBe(1);
    expect(items[0].orgao).toContain("TJ-SP");
  });

  it("filtro por area faz substring em cargo/orgao (case-insensitive)", async () => {
    setupFetchMock();
    const items = await fetchConcursos({ area: "soldado" });
    expect(items.length).toBe(1);
    expect(items[0].orgao).toContain("PM-SP");
  });

  it("erro 500 do fetch retorna []", async () => {
    setupFetchMock({ status: 500 });
    const items = await fetchConcursos({});
    expect(items).toEqual([]);
  });

  it("robots.txt Disallow bloqueia o fetch e retorna []", async () => {
    setupFetchMock({ robots: ROBOTS_BLOCKED });
    const items = await fetchConcursos({});
    expect(items).toEqual([]);
    // O fetch do HTML NAO deve ter sido feito — so o do robots.txt.
    const calls = globalThis.fetch.mock.calls.map((c) => String(c[0]));
    expect(calls.every((u) => !u.endsWith("/concursos/") && !u.includes("/sudeste/") || u.includes("robots"))).toBe(true);
  });

  it("cache hit: 2a chamada com mesma key NAO refaz fetch", async () => {
    setupFetchMock();
    const a = await fetchConcursos({ uf: "SP" });
    const callsAfter1 = globalThis.fetch.mock.calls.length;
    const b = await fetchConcursos({ uf: "SP" });
    const callsAfter2 = globalThis.fetch.mock.calls.length;
    expect(callsAfter2).toBe(callsAfter1); // nenhum fetch novo
    expect(b).toEqual(a);
  });

  it("limit respeitado: retorna no maximo N entries", async () => {
    setupFetchMock();
    const items = await fetchConcursos({ limit: 2 });
    expect(items.length).toBeLessThanOrEqual(2);
  });

  it("filtra dropa entries com schema invalido", async () => {
    // HTML com 1 concurso valido + 1 entry sem orgao (vazio) — deve dropar o invalido.
    const brokenHtml = `
      <div class="na" data-url="https://x.com/a">
        <div class="ca"><a href="https://x.com/a">Valido</a></div>
        <div class="cd">10 vagas<br><span>Cargo<br><span>Superior</span></span></div>
        <div class="ce"><span>01/12/2026</span></div>
        <div class="clear"></div></div>
      <div class="na" data-url="https://x.com/b">
        <div class="ca"><a href="https://x.com/b"></a></div>
        <div class="cd">5 vagas<br><span>X<br><span>Médio</span></span></div>
        <div class="ce"></div>
        <div class="clear"></div></div>
    `;
    setupFetchMock({ html: brokenHtml });
    const items = await fetchConcursos({});
    // Entry sem orgao = caMatch falha porque <a>...</a> tem texto vazio.
    // parseBlock retorna null nesse caso, ENTRY DROPPED.
    expect(items.length).toBe(1);
    expect(items[0].orgao).toBe("Valido");
  });
});
