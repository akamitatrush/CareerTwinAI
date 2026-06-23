import { describe, it, expect } from "vitest";
import { isPrivateIp, safeFetchExternal } from "@/lib/safe-fetch";

describe("isPrivateIp — bloqueio de IPs internos/reservados", () => {
  it("bloqueia loopback IPv4", () => {
    expect(isPrivateIp("127.0.0.1", 4)).toBe(true);
    expect(isPrivateIp("127.255.255.254", 4)).toBe(true);
  });

  it("bloqueia RFC1918 (10/8, 172.16/12, 192.168/16)", () => {
    expect(isPrivateIp("10.0.0.1", 4)).toBe(true);
    expect(isPrivateIp("10.255.255.255", 4)).toBe(true);
    expect(isPrivateIp("172.16.0.1", 4)).toBe(true);
    expect(isPrivateIp("172.31.255.255", 4)).toBe(true);
    expect(isPrivateIp("172.15.0.1", 4)).toBe(false); // antes de 16 — publico
    expect(isPrivateIp("172.32.0.1", 4)).toBe(false); // depois de 31 — publico
    expect(isPrivateIp("192.168.0.1", 4)).toBe(true);
  });

  it("bloqueia link-local 169.254 (cloud metadata)", () => {
    expect(isPrivateIp("169.254.169.254", 4)).toBe(true); // AWS/Azure metadata
  });

  it("bloqueia CGNAT 100.64/10", () => {
    expect(isPrivateIp("100.64.0.1", 4)).toBe(true);
    expect(isPrivateIp("100.127.255.254", 4)).toBe(true);
    expect(isPrivateIp("100.63.0.1", 4)).toBe(false); // fora da faixa
  });

  it("permite IPs publicos comuns", () => {
    expect(isPrivateIp("8.8.8.8", 4)).toBe(false);
    expect(isPrivateIp("1.1.1.1", 4)).toBe(false);
    expect(isPrivateIp("140.82.114.4", 4)).toBe(false); // GitHub
  });

  it("bloqueia IPv6 loopback e ULA", () => {
    expect(isPrivateIp("::1", 6)).toBe(true);
    expect(isPrivateIp("::", 6)).toBe(true);
    expect(isPrivateIp("fc00::1", 6)).toBe(true);
    expect(isPrivateIp("fd12:3456:789a::1", 6)).toBe(true);
    expect(isPrivateIp("fe80::1", 6)).toBe(true);
  });

  it("bloqueia IPv4-mapped IPv6", () => {
    expect(isPrivateIp("::ffff:127.0.0.1", 6)).toBe(true);
    expect(isPrivateIp("::ffff:169.254.169.254", 6)).toBe(true);
    expect(isPrivateIp("::ffff:8.8.8.8", 6)).toBe(false);
  });

  it("permite IPv6 publico", () => {
    expect(isPrivateIp("2606:4700:4700::1111", 6)).toBe(false); // Cloudflare DNS
    expect(isPrivateIp("2001:4860:4860::8888", 6)).toBe(false); // Google DNS
  });

  it("input invalido => bloqueado (fail closed)", () => {
    expect(isPrivateIp(null, 4)).toBe(true);
    expect(isPrivateIp("", 4)).toBe(true);
    expect(isPrivateIp(undefined, 6)).toBe(true);
  });
});

describe("safeFetchExternal — bloqueio de schemes nao-http(s)", () => {
  it("lanca scheme_not_allowed pra file:", async () => {
    await expect(safeFetchExternal("file:///etc/passwd")).rejects.toThrow(
      /scheme_not_allowed/
    );
  });

  it("lanca scheme_not_allowed pra gopher:", async () => {
    await expect(safeFetchExternal("gopher://evil.test/")).rejects.toThrow(
      /scheme_not_allowed/
    );
  });

  it("lanca hostname_blocked pra localhost", async () => {
    await expect(safeFetchExternal("http://localhost/")).rejects.toThrow(
      /hostname_blocked/
    );
  });

  it("lanca hostname_blocked pra .internal", async () => {
    await expect(safeFetchExternal("http://server.internal/")).rejects.toThrow(
      /hostname_blocked/
    );
  });
});
