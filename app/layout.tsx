import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { Nav } from "@/components/nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClaudeYacht",
  description: "YachtWorld sailboat listing scraper",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <Nav />
          <main className="mx-auto max-w-400 px-6 py-8">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
