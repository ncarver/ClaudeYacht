"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

const navLinks = [
  { href: "/scrape", label: "Scrape" },
  { href: "/results", label: "Results" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-400 items-center gap-6 px-6 py-4">
        <Link href="/" className="text-lg font-bold text-primary">
          ClaudeYacht
        </Link>
        {navLinks.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "text-sm transition-colors",
              pathname === href || pathname.startsWith(href + "/")
                ? "text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </Link>
        ))}
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
