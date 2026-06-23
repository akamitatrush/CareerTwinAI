// safe-fetch: resolve hostname, valida IP nao-privado, e PINA o IP usado no
// socket — fecha o TOCTOU classico entre safeLookup (DNS no userspace) e o
// fetch (que faz novo DNS lookup, podendo cair em outro IP — DNS rebinding).
//
// Como funciona:
//  1. URL parse + valida scheme http/https.
//  2. DNS lookup do hostname AGORA. Se IP for privado/reservado, blocked.
//  3. Faz requisicao via node:http / node:https com `lookup` custom que
//     SEMPRE retorna o IP resolvido na etapa 2 — o socket nao consulta DNS
//     de novo. Garantia: o IP que validamos e o IP usado.
//  4. Mantemos SNI (servername) e Host header com o hostname original pro
//     TLS handshake e roteamento HTTP funcionarem em servidores compartilhados.
//
// Por que nao usamos `fetch` com `dispatcher`/`agent`:
//  - Node global fetch nao expoe `agent` (undici-backed mas sem ponte publica).
//  - `undici` nao e importavel diretamente do package em todos runtimes Next.
//  - http.request/https.request sao API nativa de Node, sempre disponivel
//    em runtime "nodejs", e expoe `lookup` na mesma interface. Solucao
//    portavel + sem dep extra.
//
// API publica: safeFetchExternal(url, { method, headers, body, timeoutMs })
// Retorna { ok, status, headers, text(), json() } — interface tipo Response
// minima suficiente pros usos atuais (portfolio import: text/html scraping).

import { lookup as dnsLookup } from "node:dns/promises";
import https from "node:https";
import http from "node:http";

const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_BODY_BYTES = 1_000_000; // 1MB — portfolio sites razoaveis cabem.

// IPv4 ranges privados/reservados (RFC1918 + link-local + loopback + multicast).
// Lista expandida vs portfolio/import (incluimos CGNAT 100.64/10 e mais).
const PRIVATE_IPV4 = [
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^127\./,
  /^169\.254\./, // link-local (Azure/AWS metadata 169.254.169.254)
  /^0\./,
  /^224\./, // multicast
  /^240\./, // reserved
  /^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\./, // CGNAT 100.64/10
];
const PRIVATE_IPV6_PREFIXES = [
  "::1",
  "::",
];
const PRIVATE_IPV6_REGEX = [
  /^fc/i, // ULA fc00::/7
  /^fd/i, // ULA fd00::/8
  /^fe80/i, // link-local
];

export function isPrivateIp(ip, family) {
  if (!ip) return true;
  const x = String(ip).toLowerCase();
  if (family === 6 || x.includes(":")) {
    if (PRIVATE_IPV6_PREFIXES.includes(x)) return true;
    if (PRIVATE_IPV6_REGEX.some((r) => r.test(x))) return true;
    // IPv4-mapped IPv6 ::ffff:1.2.3.4 — extrai e checa
    const m = x.match(/^::ffff:([0-9.]+)$/);
    if (m) return PRIVATE_IPV4.some((r) => r.test(m[1]));
    return false;
  }
  return PRIVATE_IPV4.some((r) => r.test(x));
}

function isHostnameBlocked(hostname) {
  const h = String(hostname).toLowerCase();
  if (!h) return true;
  if (h === "localhost") return true;
  if (h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".lan")) return true;
  return false;
}

/**
 * Faz HTTP/HTTPS request com IP pinning anti-DNS-rebinding.
 *
 * @param {string} url
 * @param {object} [opts]
 * @param {string} [opts.method="GET"]
 * @param {object} [opts.headers={}]
 * @param {string|Buffer} [opts.body]
 * @param {number} [opts.timeoutMs=8000]
 * @param {number} [opts.maxBytes=1_000_000]
 * @returns {Promise<{ok:boolean, status:number, statusText:string, headers:object, text:Function, json:Function}>}
 */
export async function safeFetchExternal(url, opts = {}) {
  const {
    method = "GET",
    headers = {},
    body,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxBytes = MAX_BODY_BYTES,
  } = opts;

  const u = new URL(url);
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("scheme_not_allowed");
  }
  const hostname = u.hostname.replace(/^\[|\]$/g, "");
  if (isHostnameBlocked(hostname)) {
    throw new Error("hostname_blocked");
  }

  // Resolve AGORA. lookup retorna o primeiro IP do resolver — suficiente,
  // porque tambem injetamos esse IP no socket abaixo (sem novo DNS).
  // verbatim:true preserva ordem do resolver (nao reordena IPv6/IPv4).
  const resolved = await dnsLookup(hostname, { verbatim: true });
  if (!resolved?.address) {
    throw new Error("dns_failed");
  }
  if (isPrivateIp(resolved.address, resolved.family)) {
    throw new Error("private_ip_blocked");
  }

  const isHttps = u.protocol === "https:";
  const transport = isHttps ? https : http;
  const port = u.port ? Number(u.port) : isHttps ? 443 : 80;

  // path inclui search/hash quando aplicavel.
  const path = `${u.pathname || "/"}${u.search || ""}`;

  // Headers padrao: Host com hostname ORIGINAL (nao IP) — TLS SNI e
  // virtual-host funcionam. UA padrao se nao fornecido.
  const finalHeaders = {
    host: hostname,
    "user-agent": "CareerTwin",
    accept: "*/*",
    ...Object.fromEntries(
      Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
    ),
  };

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn) => {
      if (settled) return;
      settled = true;
      fn();
    };

    const req = transport.request(
      {
        method,
        host: hostname,
        port,
        path,
        headers: finalHeaders,
        // FIX o IP resolvido — sem isso, o socket faz lookup proprio (TOCTOU).
        // lookup callback estilo dns.lookup(hostname, options, cb).
        lookup: (_hostname, _options, cb) => {
          cb(null, resolved.address, resolved.family);
        },
        // TLS: servername forca SNI igual ao hostname (mesmo conectando via IP).
        servername: isHttps ? hostname : undefined,
        timeout: timeoutMs,
      },
      (res) => {
        const chunks = [];
        let total = 0;
        res.on("data", (c) => {
          total += c.length;
          if (total > maxBytes) {
            res.destroy(new Error("body_too_large"));
            return;
          }
          chunks.push(c);
        });
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          const text = () => Promise.resolve(buf.toString("utf8"));
          const json = () => text().then((t) => JSON.parse(t));
          finish(() =>
            resolve({
              ok: res.statusCode >= 200 && res.statusCode < 300,
              status: res.statusCode,
              statusText: res.statusMessage || "",
              headers: res.headers,
              text,
              json,
            })
          );
        });
        res.on("error", (e) => finish(() => reject(e)));
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error("timeout"));
    });
    req.on("error", (e) => finish(() => reject(e)));

    if (body !== undefined && body !== null) {
      req.write(body);
    }
    req.end();
  });
}
