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
  hasResearch?: boolean;
  researchStatus?: string | null;
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

// ---- Research Types ----

export interface SailboatDataSpecs {
  sailboatDataUrl: string | null;
  hullType: string | null;
  rigging: string | null;
  construction: string | null;
  displacement: number | null;
  ballast: number | null;
  loa: number | null;
  lwl: number | null;
  beam: number | null;
  draftMin: number | null;
  draftMax: number | null;
  sailArea: number | null;
  saDisplacement: number | null;
  ballastDisplacement: number | null;
  displacementLength: number | null;
  comfortRatio: number | null;
  capsizeScreening: number | null;
  engine: string | null;
  auxPowerMake: string | null;
  auxPowerModel: string | null;
  auxPowerFuel: string | null;
  water: number | null;
  designer: string | null;
  firstBuilt: number | null;
  lastBuilt: number | null;
  numberOfBoats: number | null;
}

export const defaultSailboatDataSpecs: SailboatDataSpecs = {
  sailboatDataUrl: null,
  hullType: null,
  rigging: null,
  construction: null,
  displacement: null,
  ballast: null,
  loa: null,
  lwl: null,
  beam: null,
  draftMin: null,
  draftMax: null,
  sailArea: null,
  saDisplacement: null,
  ballastDisplacement: null,
  displacementLength: null,
  comfortRatio: null,
  capsizeScreening: null,
  engine: null,
  auxPowerMake: null,
  auxPowerModel: null,
  auxPowerFuel: null,
  water: null,
  designer: null,
  firstBuilt: null,
  lastBuilt: null,
  numberOfBoats: null,
};

export const sailboatDataLabels: Record<keyof SailboatDataSpecs, string> = {
  sailboatDataUrl: "Sailboatdata.com",
  hullType: "Hull Type",
  rigging: "Rigging",
  construction: "Construction",
  displacement: "Displacement (lbs)",
  ballast: "Ballast (lbs)",
  loa: "LOA (ft)",
  lwl: "LWL (ft)",
  beam: "Beam (ft)",
  draftMin: "Draft Min (ft)",
  draftMax: "Draft Max (ft)",
  sailArea: "Sail Area (sq ft)",
  saDisplacement: "SA/D Ratio",
  ballastDisplacement: "B/D Ratio",
  displacementLength: "D/L Ratio",
  comfortRatio: "Comfort Ratio",
  capsizeScreening: "Capsize Screening",
  engine: "Engine",
  auxPowerMake: "Aux Power Make",
  auxPowerModel: "Aux Power Model",
  auxPowerFuel: "Fuel",
  water: "Water (gal)",
  designer: "Designer",
  firstBuilt: "First Built",
  lastBuilt: "Last Built",
  numberOfBoats: "# Built",
};

export function parseSailboatData(raw: string | null): SailboatDataSpecs {
  if (!raw) return { ...defaultSailboatDataSpecs };
  try {
    return { ...defaultSailboatDataSpecs, ...JSON.parse(raw) };
  } catch {
    return { ...defaultSailboatDataSpecs };
  }
}

export interface ReviewResult {
  title: string;
  source: string;
  url: string;
  excerpt: string;
}

export function parseReviews(raw: string | null): ReviewResult[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export interface ForumResult {
  title: string;
  source: string;
  url: string;
  excerpt: string;
}

export interface ForumCandidate {
  title: string;
  url: string;
  source: string;
  snippet: string;
}

export function parseForums(raw: string | null): ForumResult[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export interface ListingResearchData {
  id: number;
  listingId: number;
  status: "pending" | "running" | "complete" | "failed";
  errorMessage: string | null;
  listingSummary: string | null;
  researchedAt: string | null;
}

export interface ModelResearchData {
  id: number;
  manufacturer: string;
  boatClass: string;
  yearMin: number | null;
  yearMax: number | null;
  sailboatData: string | null;
  reviews: string | null;
  forums: string | null;
  researchedAt: string | null;
}

export interface ResearchResult {
  listing: ListingResearchData | null;
  model: ModelResearchData | null;
  capabilities: Record<string, never>;
}

export interface SailboatCandidate {
  modelName: string;
  slug: string;
  loa: string | null;
  firstBuilt: string | null;
  recommended: boolean;
}

export interface ReviewCandidate {
  title: string;
  url: string;
  source: string;
  snippet: string;
}

export interface ResearchStatus {
  listingId: number;
  status: "pending" | "running" | "waiting_for_input" | "complete" | "failed";
  step: string | null;
  errorMessage: string | null;
  candidates?: SailboatCandidate[];
  reviewCandidates?: ReviewCandidate[];
  forumCandidates?: ForumCandidate[];
}
