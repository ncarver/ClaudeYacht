import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function metersToFeet(meters: number): number {
  return meters * 3.28084;
}

export function formatPrice(price: number | null): string {
  if (price == null) return "N/A";
  return `$${price.toLocaleString("en-US")}`;
}

export function formatLength(meters: number | null): string {
  if (meters == null) return "N/A";
  const feet = metersToFeet(meters);
  return `${feet.toFixed(1)} ft`;
}
