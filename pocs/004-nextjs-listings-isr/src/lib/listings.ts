import data from "../data/listings.json";
import type { Listing } from "./types.ts";

export const listings = data as Listing[];

export async function getListings(): Promise<Listing[]> {
  return listings;
}

export async function getListing(id: string): Promise<Listing | undefined> {
  return listings.find((l) => l.id === id);
}
