export interface Listing {
  id: number;
  linkUrl: string;
  buildYear: number | null;
  listingName: string | null;
  sellerName: string | null;
  sellerLocation: string | null;
  imgUrl: string | null;
  manufacturer: string | null;
  boatClass: string | null;
  lengthInMeters: number | null;
  state: string | null;
  priceUSD: number | null;
  dateLoaded: string;
  fileSource: string;
  notes: string;
  thumbs: "up" | "down" | null;
  favorite: boolean;
  properties: string;
}

export interface BoatProperties {
  doubleEnder: boolean;
  tillerSteering: boolean;
  furlingMain: boolean;
  inlineGalley: boolean;
  travellerInCockpit: boolean;
  saildrive: boolean;
  woodConstruction: boolean;
  aluminumConstruction: boolean;
  deckSteppedMast: boolean;
}

export const defaultBoatProperties: BoatProperties = {
  doubleEnder: false,
  tillerSteering: false,
  furlingMain: false,
  inlineGalley: false,
  travellerInCockpit: false,
  saildrive: false,
  woodConstruction: false,
  aluminumConstruction: false,
  deckSteppedMast: false,
};

export const boatPropertyLabels: Record<keyof BoatProperties, string> = {
  doubleEnder: "Double-ender",
  tillerSteering: "Tiller steering",
  furlingMain: "Furling main",
  inlineGalley: "Inline galley",
  travellerInCockpit: "Traveller in cockpit",
  saildrive: "Saildrive",
  woodConstruction: "Wood construction",
  aluminumConstruction: "Aluminum construction",
  deckSteppedMast: "Deck-stepped mast",
};

export function parseProperties(raw: string): BoatProperties {
  try {
    return { ...defaultBoatProperties, ...JSON.parse(raw) };
  } catch {
    return { ...defaultBoatProperties };
  }
}

export interface TriStateFilter {
  include: string[];
  exclude: string[];
}

export interface ScrapeParams {
  priceMin: number;
  priceMax: number;
  lengthMinFt: number;
  lengthMaxFt: number;
  condition: "used" | "new" | "any";
  excludeKetchYawl: boolean;
  excludeMultihull: boolean;
  outputFileName: string;
}

export interface ScrapeStatus {
  running: boolean;
  startedAt: string | null;
  outputFile: string | null;
  error: string | null;
}

export interface Filters {
  manufacturers: TriStateFilter;
  states: TriStateFilter;
  priceMin: number | null;
  priceMax: number | null;
  lengthMinFt: number | null;
  lengthMaxFt: number | null;
  yearMin: number | null;
  yearMax: number | null;
  favoritesOnly: boolean;
  hideThumbsDown: boolean;
}

export interface ScrapeFileInfo {
  fileName: string;
  size: number;
  createdAt: string;
}
