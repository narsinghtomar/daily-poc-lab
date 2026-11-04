import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getListing, getListings } from "@/lib/listings";
import styles from "../listings.module.css";

// ISR: the page is generated at build time and regenerated in the background
// at most once per minute after a request arrives past that window.
export const revalidate = 60;

// Ids not returned by generateStaticParams render on first request, then are
// cached like the rest. Unknown ids hit notFound().
export const dynamicParams = true;

export async function generateStaticParams() {
  const all = await getListings();
  return all.map((l) => ({ id: l.id }));
}

export async function generateMetadata({ params }: PageProps<"/listings/[id]">): Promise<Metadata> {
  const listing = await getListing((await params).id);
  return { title: listing ? listing.title : "Listing not found" };
}

export default async function ListingPage({ params }: PageProps<"/listings/[id]">) {
  const listing = await getListing((await params).id);
  if (!listing) notFound();

  return (
    <main className={styles.main}>
      <p><Link href="/listings">← All listings</Link></p>
      <h1>{listing.title}</h1>
      <p>
        {listing.city} · {listing.type} ·{" "}
        {listing.bedrooms === 0 ? "studio" : `${listing.bedrooms} bed`}
      </p>
      <p className={styles.price}>€{listing.price.toLocaleString("en-US")}/mo</p>
      <p><small>Rendered at {new Date().toISOString()}</small></p>
    </main>
  );
}
