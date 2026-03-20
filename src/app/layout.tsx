import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClauseGuard — Contract Clause Analyzer",
  description: "Upload a contract and instantly identify unusual or aggressive clauses compared to industry standards.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="h-full overflow-hidden" style={{ fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
