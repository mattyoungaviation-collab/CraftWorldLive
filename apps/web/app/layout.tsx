export const metadata = {
  title: "Craft World Calculator",
  description: "Public profitability calculator for Craft World"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>
        <div style={{ display: "flex", minHeight: "100vh" }}>
          <aside style={{ width: 260, borderRight: "1px solid #eee", padding: 16 }}>
            <h2 style={{ marginTop: 0 }}>Craft World</h2>
            <nav style={{ display: "grid", gap: 8 }}>
              <a href="/" style={{ textDecoration: "none" }}>Login</a>
              <a href="/calculator" style={{ textDecoration: "none" }}>Calculator</a>
              <a href="/profiles" style={{ textDecoration: "none" }}>Profiles</a>
            </nav>
            <p style={{ marginTop: 16, fontSize: 12, color: "#666" }}>
              WalletConnect v2 + Craft World auth.
            </p>
          </aside>
          <main style={{ flex: 1, padding: 24 }}>{children}</main>
        </div>
      </body>
    </html>
  );
}
