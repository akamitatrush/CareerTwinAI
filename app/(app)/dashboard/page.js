import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dashboard — CareerTwin AI",
};

export default function DashboardPlaceholder() {
  return (
    <div className="app-container">
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 28,
          fontWeight: 700,
          color: "var(--text)",
          marginBottom: 8,
        }}
      >
        Dashboard
      </h1>
      <p style={{ color: "var(--text-muted)", maxWidth: 640 }}>
        Em construção. Esta é a fundação da nova versão do produto.
      </p>
      <p style={{ marginTop: 24, fontSize: 13, color: "var(--text-soft)" }}>
        Volte mais tarde — ou veja a versão atual em{" "}
        <Link href="/meu-gemeo" style={{ color: "var(--primary)" }}>
          /meu-gemeo
        </Link>
        .
      </p>
    </div>
  );
}
