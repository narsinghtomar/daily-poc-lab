import type { StaticImageData } from "next/image";
import apartment from "../assets/apartment.png";
import house from "../assets/house.png";
import studio from "../assets/studio.png";
import type { PropertyType } from "./types.ts";

const PHOTOS: Record<PropertyType, StaticImageData> = { apartment, house, studio };

/** Static imports give next/image width, height and a blur placeholder at build time. */
export function photoFor(type: PropertyType): StaticImageData {
  return PHOTOS[type];
}
