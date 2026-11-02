export type ListingType = "apartment" | "villa" | "studio" | "house";

export interface Listing {
  id: string;
  title: string;
  city: string;
  type: ListingType;
  price: number;
  bedrooms: number;
  area: number;
  listedAt: string;
}
