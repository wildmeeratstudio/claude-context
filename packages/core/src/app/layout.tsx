import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Claude Context - Semantic Search",
  description: "Test claude-context-core semantic search functionality",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
