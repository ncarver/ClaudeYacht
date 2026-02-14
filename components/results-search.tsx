"use client";

import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface ResultsSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function ResultsSearch({ value, onChange }: ResultsSearchProps) {
  const [local, setLocal] = useState(value);

  // Debounce: propagate after 300ms of no typing
  useEffect(() => {
    const timer = setTimeout(() => onChange(local), 300);
    return () => clearTimeout(timer);
  }, [local, onChange]);

  // Sync external value changes
  useEffect(() => {
    setLocal(value);
  }, [value]);

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder="Search listings..."
        className="pl-9"
      />
    </div>
  );
}
