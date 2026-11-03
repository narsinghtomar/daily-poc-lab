export type PropertyType = "apartment" | "house" | "studio";

export interface Listing {
  id: string;
  title: string;
  city: string;
  type: PropertyType;
  price: number;
  bedrooms: number;
}
