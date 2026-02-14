import { spawn, type ChildProcess } from "child_process";
import path from "path";
import type { ScrapeParams, ScrapeStatus } from "./types";
import { getDataDir, listJsonlFiles } from "./data-dir";
import { ingestFile } from "./ingest";

interface ScrapeState {
  running: boolean;
  startedAt: string | null;
  outputFile: string | null;
  error: string | null;
  process: ChildProcess | null;
}

const defaultState: ScrapeState = {
  running: false,
  startedAt: null,
  outputFile: null,
  error: null,
  process: null,
};

// Persist state across HMR reloads in development
declare global {
  // eslint-disable-next-line no-var
  var scrapeState: ScrapeState | undefined;
}

function getState(): ScrapeState {
  if (!globalThis.scrapeState) {
    globalThis.scrapeState = { ...defaultState };
  }
  return globalThis.scrapeState;
}

export function getScrapeStatus(): ScrapeStatus {
  const state = getState();
  return {
    running: state.running,
    startedAt: state.startedAt,
    outputFile: state.outputFile,
    error: state.error,
  };
}

export function startScrape(params: ScrapeParams): ScrapeStatus {
  const state = getState();

  if (state.running) {
    throw new Error("A scrape is already running");
  }

  // Build output file path
  const fileName = params.outputFileName.endsWith(".jsonl")
    ? params.outputFileName
    : `${params.outputFileName}.jsonl`;
  const outputPath = path.join(getDataDir(), fileName);

  // Build CLI arguments
  const args = [
    path.join(process.cwd(), "scripts", "scrape_yachtworld.js"),
    "--priceMin",
    String(params.priceMin),
    "--priceMax",
    String(params.priceMax),
    "--lengthMinFt",
    String(params.lengthMinFt),
    "--lengthMaxFt",
    String(params.lengthMaxFt),
    "--condition",
    params.condition,
    "--excludeKetchYawl",
    String(params.excludeKetchYawl),
    "--excludeMultihull",
    String(params.excludeMultihull),
    "--outputFile",
    outputPath,
  ];

  // Update state before spawning
  state.running = true;
  state.startedAt = new Date().toISOString();
  state.outputFile = fileName;
  state.error = null;

  const child = spawn("node", args, {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
  });

  state.process = child;

  let stderr = "";

  child.stderr?.on("data", (data: Buffer) => {
    stderr += data.toString();
  });

  child.stdout?.on("data", (data: Buffer) => {
    // Log scraper output to Next.js console
    process.stdout.write(data);
  });

  child.on("exit", async (code) => {
    state.running = false;
    state.process = null;
    if (code !== 0) {
      state.error = stderr || `Scraper exited with code ${code}`;
    } else {
      // Auto-ingest on successful scrape
      try {
        const result = await ingestFile(fileName);
        console.log(
          `Auto-ingest: ${result.inserted} inserted, ${result.skipped} skipped, ${result.errors} errors`
        );
      } catch (err) {
        console.error("Auto-ingest failed:", err);
      }
    }
  });

  child.on("error", (err) => {
    state.running = false;
    state.process = null;
    state.error = err.message;
  });

  return getScrapeStatus();
}

export function listPastScrapes() {
  return listJsonlFiles();
}
