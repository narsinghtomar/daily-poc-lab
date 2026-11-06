import { CardSkeleton } from "./skeleton";
import styles from "./listings.module.css";

// Shown instantly while /listings renders on the server (Suspense boundary).
export default function Loading() {
  return (
    <main className={styles.main} aria-busy="true">
      <h1>Listings</h1>
      <p role="status">Loading listings…</p>
      <ul className={styles.grid}>
        {Array.from({ length: 6 }, (_, i) => (
          <CardSkeleton key={i} />
        ))}
      </ul>
    </main>
  );
}
