"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getListing } from "@/lib/listings";
import { SAVED_COOKIE, parseSaved, serializeSaved, setSaved } from "@/lib/saved";

/**
 * Save or unsave a listing. Saved ids live in a cookie so each visitor has
 * their own list without a database. Server Actions are public endpoints, so
 * the id is validated against real listings before anything is written.
 */
export async function setListingSaved(id: string, saved: boolean): Promise<void> {
  if (typeof id !== "string" || !(await getListing(id))) {
    throw new Error("Unknown listing");
  }
  const jar = await cookies();
  const next = setSaved(parseSaved(jar.get(SAVED_COOKIE)?.value), id, Boolean(saved));
  jar.set(SAVED_COOKIE, serializeSaved(next), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  revalidatePath("/listings");
}
