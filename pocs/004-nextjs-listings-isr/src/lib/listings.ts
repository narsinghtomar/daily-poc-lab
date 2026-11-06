import data from "../data/listings.json";
import type { Listing } from "./types.ts";

export const listings = data as Listing[];

// Stand-in for database latency so the loading skeletons are visible in dev.
// Set LISTINGS_LATENCY_MS=0 (or leave unset) to disable.
async function simulateLatency() {
  const ms = Number(process.env.LISTINGS_LATENCY_MS ?? 0);
  if (Number.isFinite(ms) && ms > 0) await new Promise((r) => setTimeout(r, ms));
}

export async function getListings(): Promise<Listing[]> {
  await simulateLatency();
  return listings;
}

export async function getListing(id: string): Promise<Listing | undefined> {
  await simulateLatency();
  return listings.find((l) => l.id === id);
}
