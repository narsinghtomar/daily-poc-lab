import { getListings } from "@/lib/listings";

export default async function Home() {
  const listings = await getListings();
  return (
    <main>
      <h1>Listings ({listings.length})</h1>
      <ul>
        {listings.map((l) => (
          <li key={l.id}>
            {l.title} · {l.city} · ₹{l.price.toLocaleString("en-IN")}
          </li>
        ))}
      </ul>
    </main>
  );
}
