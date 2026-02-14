"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { ScrapeParams } from "@/lib/types";

interface ScrapeFormProps {
  onSubmit: (params: ScrapeParams) => void;
  disabled: boolean;
}

function defaultFileName(): string {
  const now = new Date();
  return `scrape_${now.toISOString().replace(/[:.]/g, "-").slice(0, 19)}`;
}

export function ScrapeForm({ onSubmit, disabled }: ScrapeFormProps) {
  const [priceMin, setPriceMin] = useState("10000");
  const [priceMax, setPriceMax] = useState("100000");
  const [lengthMinFt, setLengthMinFt] = useState("37");
  const [lengthMaxFt, setLengthMaxFt] = useState("42");
  const [condition, setCondition] = useState<"used" | "new" | "any">("used");
  const [excludeKetchYawl, setExcludeKetchYawl] = useState(true);
  const [excludeMultihull, setExcludeMultihull] = useState(true);
  const [outputFileName, setOutputFileName] = useState(defaultFileName);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      priceMin: Number(priceMin),
      priceMax: Number(priceMax),
      lengthMinFt: Number(lengthMinFt),
      lengthMaxFt: Number(lengthMaxFt),
      condition,
      excludeKetchYawl,
      excludeMultihull,
      outputFileName,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Price Range */}
        <div className="space-y-2">
          <Label>Min Price (USD)</Label>
          <Input
            type="number"
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value)}
            min={0}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label>Max Price (USD)</Label>
          <Input
            type="number"
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value)}
            min={0}
            disabled={disabled}
          />
        </div>

        {/* Length Range */}
        <div className="space-y-2">
          <Label>Min Length (ft)</Label>
          <Input
            type="number"
            value={lengthMinFt}
            onChange={(e) => setLengthMinFt(e.target.value)}
            min={0}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label>Max Length (ft)</Label>
          <Input
            type="number"
            value={lengthMaxFt}
            onChange={(e) => setLengthMaxFt(e.target.value)}
            min={0}
            disabled={disabled}
          />
        </div>

        {/* Condition */}
        <div className="space-y-2">
          <Label>Condition</Label>
          <Select
            value={condition}
            onValueChange={(v) => setCondition(v as "used" | "new" | "any")}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="used">Used</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="any">Any</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Exclusions */}
        <div className="flex items-center gap-6 pt-6 col-span-full">
          <div className="flex items-center gap-3">
            <Switch
              checked={excludeKetchYawl}
              onCheckedChange={setExcludeKetchYawl}
              disabled={disabled}
            />
            <Label>Exclude Ketch &amp; Yawl</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={excludeMultihull}
              onCheckedChange={setExcludeMultihull}
              disabled={disabled}
            />
            <Label>Exclude Multihull</Label>
          </div>
        </div>
      </div>

      {/* Output File Name */}
      <div className="space-y-2">
        <Label>Output File Name</Label>
        <div className="flex items-center gap-2">
          <Input
            value={outputFileName}
            onChange={(e) => setOutputFileName(e.target.value)}
            placeholder="scrape_2025-01-01"
            disabled={disabled}
          />
          <span className="text-sm text-muted-foreground shrink-0">
            .jsonl
          </span>
        </div>
      </div>

      <Button type="submit" disabled={disabled} className="w-full sm:w-auto">
        {disabled ? "Scraping..." : "Start Scrape"}
      </Button>
    </form>
  );
}
