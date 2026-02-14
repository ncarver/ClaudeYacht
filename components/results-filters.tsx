"use client";

import { useState, useMemo } from "react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Check, Star, ThumbsDown, X } from "lucide-react";
import type { Listing, Filters, TriStateFilter } from "@/lib/types";
import {
  getUniqueValues,
  getNumericRange,
  defaultFilters,
  matchesFiltersExcept,
} from "@/lib/filters";
import { metersToFeet, formatPrice, cn } from "@/lib/utils";

interface FilterRailProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  listings: Listing[];
}

function SectionHeader({
  label,
  isActive,
  onClear,
}: {
  label: string;
  isActive: boolean;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {isActive && (
        <button
          onClick={onClear}
          className="text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-muted transition-colors"
          title={`Clear ${label.toLowerCase()}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function TriStateCheckboxGroup({
  label,
  values,
  filter,
  onToggle,
  isActive,
  onClear,
}: {
  label: string;
  values: string[];
  filter: TriStateFilter;
  onToggle: (value: string) => void;
  isActive?: boolean;
  onClear?: () => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return values;
    const lower = search.toLowerCase();
    return values.filter((v) => v.toLowerCase().includes(lower));
  }, [values, search]);

  function getState(value: string): "neutral" | "include" | "exclude" {
    if (filter.include.includes(value)) return "include";
    if (filter.exclude.includes(value)) return "exclude";
    return "neutral";
  }

  return (
    <div className="space-y-2">
      <SectionHeader
        label={label}
        isActive={!!isActive}
        onClear={onClear ?? (() => {})}
      />
      {values.length > 6 && (
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Filter ${label.toLowerCase()}...`}
          className="h-7 text-xs"
        />
      )}
      <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
        {filtered.map((value) => {
          const state = getState(value);
          return (
            <div
              key={value}
              className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-muted"
              onClick={() => onToggle(value)}
            >
              <span
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                  state === "neutral" && "border-border bg-input",
                  state === "include" &&
                    "border-green-500 bg-green-500 text-white",
                  state === "exclude" &&
                    "border-red-500 bg-red-500 text-white"
                )}
              >
                {state === "include" && <Check className="h-3 w-3" />}
                {state === "exclude" && <X className="h-3 w-3" />}
              </span>
              <span
                className={cn(
                  "truncate",
                  state === "exclude" && "line-through text-muted-foreground"
                )}
              >
                {value}
              </span>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground px-1">No matches</p>
        )}
      </div>
    </div>
  );
}

function RangeSlider({
  label,
  min,
  max,
  value,
  onChange,
  formatValue,
  step,
  isActive,
  onClear,
}: {
  label: string;
  min: number;
  max: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
  formatValue: (n: number) => string;
  step?: number;
  isActive?: boolean;
  onClear?: () => void;
}) {
  if (min >= max) return null;

  return (
    <div className="space-y-2">
      <SectionHeader
        label={label}
        isActive={!!isActive}
        onClear={onClear ?? (() => {})}
      />
      <Slider
        min={min}
        max={max}
        step={step ?? 1}
        value={value}
        onValueChange={(v) => onChange(v as [number, number])}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{formatValue(value[0])}</span>
        <span>{formatValue(value[1])}</span>
      </div>
    </div>
  );
}

function cycleTriState(
  filter: TriStateFilter,
  value: string
): TriStateFilter {
  if (filter.include.includes(value)) {
    return {
      include: filter.include.filter((v) => v !== value),
      exclude: [...filter.exclude, value],
    };
  }
  if (filter.exclude.includes(value)) {
    return {
      include: filter.include,
      exclude: filter.exclude.filter((v) => v !== value),
    };
  }
  return {
    include: [...filter.include, value],
    exclude: filter.exclude,
  };
}

export function FilterRail({ filters, onChange, listings }: FilterRailProps) {
  // Cross-filtered listings: for each dimension, apply all OTHER filters
  const forManufacturers = useMemo(
    () =>
      listings.filter((l) =>
        matchesFiltersExcept(l, filters, "manufacturers")
      ),
    [listings, filters]
  );
  const forStates = useMemo(
    () =>
      listings.filter((l) => matchesFiltersExcept(l, filters, "states")),
    [listings, filters]
  );
  const forPrice = useMemo(
    () =>
      listings.filter((l) => matchesFiltersExcept(l, filters, "price")),
    [listings, filters]
  );
  const forLength = useMemo(
    () =>
      listings.filter((l) => matchesFiltersExcept(l, filters, "length")),
    [listings, filters]
  );
  const forYear = useMemo(
    () =>
      listings.filter((l) => matchesFiltersExcept(l, filters, "year")),
    [listings, filters]
  );

  // Compute available options from cross-filtered sets
  const manufacturers = useMemo(
    () => getUniqueValues(forManufacturers, "manufacturer"),
    [forManufacturers]
  );
  const states = useMemo(
    () => getUniqueValues(forStates, "state"),
    [forStates]
  );
  const [priceMin, priceMax] = useMemo(
    () => getNumericRange(forPrice, "priceUSD"),
    [forPrice]
  );
  const [yearMin, yearMax] = useMemo(
    () => getNumericRange(forYear, "buildYear"),
    [forYear]
  );

  // Compute length range in feet from cross-filtered set
  const [lengthMinFt, lengthMaxFt] = useMemo(() => {
    const [minM, maxM] = getNumericRange(forLength, "lengthInMeters");
    return [Math.floor(metersToFeet(minM)), Math.ceil(metersToFeet(maxM))];
  }, [forLength]);

  function update(partial: Partial<Filters>) {
    onChange({ ...filters, ...partial });
  }

  // Clamp slider values to cross-filtered ranges
  function clamp(
    val: number | null,
    min: number,
    max: number,
    fallback: number
  ): number {
    if (val == null) return fallback;
    return Math.max(min, Math.min(max, val));
  }

  const hasAny =
    filters.manufacturers.include.length > 0 ||
    filters.manufacturers.exclude.length > 0 ||
    filters.states.include.length > 0 ||
    filters.states.exclude.length > 0 ||
    filters.priceMin != null ||
    filters.priceMax != null ||
    filters.lengthMinFt != null ||
    filters.lengthMaxFt != null ||
    filters.yearMin != null ||
    filters.yearMax != null ||
    filters.favoritesOnly ||
    filters.hideThumbsDown;

  return (
    <div className="space-y-6">
      {/* Manufacturer tri-state */}
      <TriStateCheckboxGroup
        label="Manufacturer"
        values={manufacturers}
        filter={filters.manufacturers}
        onToggle={(v) =>
          update({
            manufacturers: cycleTriState(filters.manufacturers, v),
          })
        }
        isActive={
          filters.manufacturers.include.length > 0 ||
          filters.manufacturers.exclude.length > 0
        }
        onClear={() =>
          update({ manufacturers: { include: [], exclude: [] } })
        }
      />

      {/* State tri-state */}
      <TriStateCheckboxGroup
        label="State"
        values={states}
        filter={filters.states}
        onToggle={(v) =>
          update({ states: cycleTriState(filters.states, v) })
        }
        isActive={
          filters.states.include.length > 0 ||
          filters.states.exclude.length > 0
        }
        onClear={() =>
          update({ states: { include: [], exclude: [] } })
        }
      />

      {/* Price slider */}
      <RangeSlider
        label="Price"
        min={priceMin}
        max={priceMax}
        value={[
          clamp(filters.priceMin, priceMin, priceMax, priceMin),
          clamp(filters.priceMax, priceMin, priceMax, priceMax),
        ]}
        onChange={([lo, hi]) =>
          update({
            priceMin: lo === priceMin ? null : lo,
            priceMax: hi === priceMax ? null : hi,
          })
        }
        formatValue={formatPrice}
        step={1000}
        isActive={filters.priceMin != null || filters.priceMax != null}
        onClear={() => update({ priceMin: null, priceMax: null })}
      />

      {/* Length slider */}
      <RangeSlider
        label="Length (ft)"
        min={lengthMinFt}
        max={lengthMaxFt}
        value={[
          clamp(filters.lengthMinFt, lengthMinFt, lengthMaxFt, lengthMinFt),
          clamp(filters.lengthMaxFt, lengthMinFt, lengthMaxFt, lengthMaxFt),
        ]}
        onChange={([lo, hi]) =>
          update({
            lengthMinFt: lo === lengthMinFt ? null : lo,
            lengthMaxFt: hi === lengthMaxFt ? null : hi,
          })
        }
        formatValue={(n) => `${n} ft`}
        isActive={
          filters.lengthMinFt != null || filters.lengthMaxFt != null
        }
        onClear={() => update({ lengthMinFt: null, lengthMaxFt: null })}
      />

      {/* Year range */}
      {yearMin < yearMax && (
        <RangeSlider
          label="Build Year"
          min={yearMin}
          max={yearMax}
          value={[
            clamp(filters.yearMin, yearMin, yearMax, yearMin),
            clamp(filters.yearMax, yearMin, yearMax, yearMax),
          ]}
          onChange={([lo, hi]) =>
            update({
              yearMin: lo === yearMin ? null : lo,
              yearMax: hi === yearMax ? null : hi,
            })
          }
          formatValue={(n) => String(n)}
          isActive={filters.yearMin != null || filters.yearMax != null}
          onClear={() => update({ yearMin: null, yearMax: null })}
        />
      )}

      {/* Favorites toggle */}
      <div className="space-y-2">
        <SectionHeader
          label="Favorites"
          isActive={filters.favoritesOnly}
          onClear={() => update({ favoritesOnly: false })}
        />
        <div className="flex items-center gap-2">
          <Switch
            checked={filters.favoritesOnly}
            onCheckedChange={(checked) =>
              update({ favoritesOnly: !!checked })
            }
          />
          <Label className="flex items-center gap-1 text-xs">
            <Star className="h-3 w-3" />
            Favorites only
          </Label>
        </div>
      </div>

      {/* Hide thumbs down */}
      <div className="space-y-2">
        <SectionHeader
          label="Thumbs Down"
          isActive={filters.hideThumbsDown}
          onClear={() => update({ hideThumbsDown: false })}
        />
        <div className="flex items-center gap-2">
          <Switch
            checked={filters.hideThumbsDown}
            onCheckedChange={(checked) =>
              update({ hideThumbsDown: !!checked })
            }
          />
          <Label className="flex items-center gap-1 text-xs">
            <ThumbsDown className="h-3 w-3" />
            Hide thumbs down
          </Label>
        </div>
      </div>

      {/* Clear all */}
      {hasAny && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange({ ...defaultFilters })}
          className="w-full"
        >
          Clear all filters
        </Button>
      )}
    </div>
  );
}
