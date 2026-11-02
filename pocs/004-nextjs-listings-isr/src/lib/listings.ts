import data from "../data/listings.json" with { type: "json" };
import type { Listing } from "./types.ts";

const listings = data as Listing[];

/** Simulates an async data source so callers are already shaped for a real DB/API. */
export async function getListings(): Promise<Listing[]> {
  return listings.map((l) => ({ ...l }));
}

export async function getListingById(id: string): Promise<Listing | undefined> {
  const all = await getListings();
  return all.find((l) => l.id === id);
}
