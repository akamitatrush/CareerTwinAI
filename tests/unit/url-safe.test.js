import { describe, it, expect } from "vitest";
import { safeHref } from "@/lib/url-safe";
import { safeExternalUrl } from "@/lib/validators";

describe("safeHref", () => {
  it("aceita http", () => expect(safeHref("http://example.com")).toBe("http://example.com"));
  it("aceita https", () => expect(safeHref("https://example.com")).toBe("https://example.com"));
  it("rejeita javascript:", () => expect(safeHref("javascript:alert(1)")).toBe(null));
  it("rejeita data:", () => expect(safeHref("data:text/html,<script>")).toBe(null));
  it("rejeita vbscript:", () => expect(safeHref("vbscript:msgbox(1)")).toBe(null));
  it("rejeita file:", () => expect(safeHref("file:///etc/passwd")).toBe(null));
  it("rejeita string vazia", () => expect(safeHref("")).toBe(null));
  it("rejeita null", () => expect(safeHref(null)).toBe(null));
  it("rejeita undefined", () => expect(safeHref(undefined)).toBe(null));
  it("rejeita URL malformada", () => expect(safeHref("not-a-url")).toBe(null));
  it("aceita https com query string", () =>
    expect(safeHref("https://example.com/path?q=1")).toBe("https://example.com/path?q=1")
  );
});

describe("safeExternalUrl validator", () => {
  it("aceita http/https", () => {
    expect(safeExternalUrl.safeParse("https://example.com").success).toBe(true);
    expect(safeExternalUrl.safeParse("http://example.com").success).toBe(true);
  });
  it("rejeita schemes perigosos", () => {
    expect(safeExternalUrl.safeParse("javascript:alert(1)").success).toBe(false);
    expect(safeExternalUrl.safeParse("data:text/html,<script>").success).toBe(false);
    expect(safeExternalUrl.safeParse("vbscript:msgbox(1)").success).toBe(false);
    expect(safeExternalUrl.safeParse("file:///etc/passwd").success).toBe(false);
  });
  it("aceita vazio", () => {
    expect(safeExternalUrl.safeParse("").success).toBe(true);
  });
});
