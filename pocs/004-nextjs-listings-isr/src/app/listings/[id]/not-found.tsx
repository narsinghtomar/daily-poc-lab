import Link from "next/link";
import styles from "../listings.module.css";

export default function ListingNotFound() {
  return (
    <main className={styles.main}>
      <h1>Listing not found</h1>
      <p><Link href="/listings">Back to all listings</Link></p>
    </main>
  );
}
