import styles from "../listings.module.css";

export default function Loading() {
  return (
    <main className={styles.main} aria-busy="true">
      <div className={`${styles.skeleton} ${styles.skelTitle}`} />
      <div className={`${styles.skeleton} ${styles.hero}`} />
      <div className={`${styles.skeleton} ${styles.skelLine} ${styles.skelShort}`} />
    </main>
  );
}
