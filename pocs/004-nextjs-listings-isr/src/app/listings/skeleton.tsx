import styles from "./listings.module.css";

export function CardSkeleton() {
  return (
    <li className={styles.card} aria-hidden="true">
      <div className={`${styles.skeleton} ${styles.skelPhoto}`} />
      <div className={`${styles.skeleton} ${styles.skelLine}`} />
      <div className={`${styles.skeleton} ${styles.skelLine} ${styles.skelShort}`} />
    </li>
  );
}
