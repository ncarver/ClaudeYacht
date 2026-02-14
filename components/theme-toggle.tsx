"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Monitor, Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="h-8 w-8" />;
  }

  function cycle() {
    if (theme === "system") setTheme("light");
    else if (theme === "light") setTheme("dark");
    else setTheme("system");
  }

  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  return (
    <button
      onClick={cycle}
      className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      title={`Theme: ${theme}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
