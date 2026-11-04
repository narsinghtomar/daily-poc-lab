import type { Metadata } from "next";
import Link from "next/link";
import { getListings } from "@/lib/listings";
import { applyFilters, parseFilters } from "@/lib/filters";
import styles from "./listings.module.css";

export const metadata: Metadata = { title: "Listings" };

export default async function ListingsPage({ searchParams }: PageProps<"/listings">) {
  const filters = parseFilters(await searchParams);
  const all = await getListings();
  const cities = [...new Set(all.map((l) => l.city))].sort();
  const results = applyFilters(all, filters);

  return (
    <main className={styles.main}>
      <h1>Listings</h1>

      {/* Plain GET form: filters live in the URL, so no client JS is needed. */}
      <form method="get" className={styles.filters}>
        <label>
          City
          <select name="city" defaultValue={filters.city ?? ""}>
            <option value="">Any</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Type
          <select name="type" defaultValue={filters.type ?? ""}>
            <option value="">Any</option>
            <option value="apartment">Apartment</option>
            <option value="house">House</option>
            <option value="studio">Studio</option>
          </select>
        </label>
        <label>
          Min bedrooms
          <input type="number" name="bedrooms" min={0} defaultValue={filters.minBedrooms} />
        </label>
        <label>
          Max price
          <input type="number" name="maxPrice" min={0} step={50} defaultValue={filters.maxPrice} />
        </label>
        <button type="submit">Apply</button>
        <a href="/listings">Reset</a>
      </form>

      <p aria-live="polite">{results.length} of {all.length} listings</p>

      {results.length === 0 ? (
        <p>No listings match these filters.</p>
      ) : (
        <ul className={styles.grid}>
          {results.map((l) => (
            <li key={l.id} className={styles.card}>
              <h2><Link href={`/listings/${l.id}`}>{l.title}</Link></h2>
              <p>{l.city} · {l.type} · {l.bedrooms === 0 ? "studio" : `${l.bedrooms} bed`}</p>
              <p className={styles.price}>€{l.price.toLocaleString("en-US")}/mo</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
