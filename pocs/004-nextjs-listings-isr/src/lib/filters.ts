import type { Listing, PropertyType } from "./types.ts";

export type RawSearchParams = Record<string, string | string[] | undefined>;

export interface ListingFilters {
  city?: string;
  type?: PropertyType;
  minBedrooms?: number;
  maxPrice?: number;
}

const TYPES: readonly PropertyType[] = ["apartment", "house", "studio"];

// Repeated params (?city=a&city=b) arrive as arrays; use the first value.
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function toNonNegativeInt(v: string | undefined): number | undefined {
  if (v === undefined || v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : undefined;
}

/** Turn untrusted URL params into a typed filter object; invalid values are dropped. */
export function parseFilters(params: RawSearchParams): ListingFilters {
  const city = first(params.city)?.trim();
  const type = first(params.type) as PropertyType | undefined;
  return {
    city: city || undefined,
    type: type && TYPES.includes(type) ? type : undefined,
    minBedrooms: toNonNegativeInt(first(params.bedrooms)),
    maxPrice: toNonNegativeInt(first(params.maxPrice)),
  };
}

export function applyFilters(items: Listing[], f: ListingFilters): Listing[] {
  const city = f.city?.toLowerCase();
  return items.filter(
    (l) =>
      (city === undefined || l.city.toLowerCase() === city) &&
      (f.type === undefined || l.type === f.type) &&
      (f.minBedrooms === undefined || l.bedrooms >= f.minBedrooms) &&
      (f.maxPrice === undefined || l.price <= f.maxPrice),
  );
}
