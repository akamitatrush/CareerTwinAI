// GET /api/metrics/median — endpoint publico que retorna a mediana atual de
// contratados (stub OU real). NAO requer auth — dado agregado sem PII.
//
// Resposta:
//  {
//    value: number,           // mediana (78 stub, ou calculada)
//    isStub: boolean,         // true enquanto sampleSize < threshold
//    sampleSize: number,      // count de outcomes HIRED/HIRED_DIFFERENT
//    thresholdToReal: number  // 50 — exposto pra UI mostrar progresso
//  }
//
// Cache: response cache headers s-maxage=3600 (1h). Edge/CDN serve sem hit no
// backend. Compativel com Vercel Data Cache. Em paralelo, getRealMedian() tem
// cache em memoria proprio (1h) — duas camadas, ambas seguras pra dado agregado.
//
// Sem PII no payload — public-cacheable.

import { NextResponse } from "next/server";
import { getRealMedian } from "@/lib/metrics/median-real";

export const runtime = "nodejs";
// Revalidate 1h. Pareado com cache em memoria do getRealMedian, da janela
// efetiva de 1-2h (worst case dois caches desalinhados). Pra mediana real que
// muda devagar, totalmente aceitavel.
export const revalidate = 3600;

export async function GET() {
  try {
    const median = await getRealMedian();
    return NextResponse.json(median, {
      headers: {
        // Cache CDN/browser 1h. Stale-while-revalidate 6h pra graceful
        // degradation se backend cair.
        "cache-control": "public, s-maxage=3600, stale-while-revalidate=21600",
      },
    });
  } catch (e) {
    console.error("metrics/median falhou:", e?.message);
    // Failsafe: 200 com stub. NUNCA quebrar o dashboard por causa dessa rota.
    return NextResponse.json(
      {
        value: 78,
        isStub: true,
        sampleSize: 0,
        thresholdToReal: 50,
      },
      { status: 200 }
    );
  }
}
