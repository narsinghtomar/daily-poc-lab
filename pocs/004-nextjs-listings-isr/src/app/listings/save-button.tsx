"use client";

import { useOptimistic } from "react";
import { setListingSaved } from "./actions";
import styles from "./listings.module.css";

export function SaveButton({ id, saved }: { id: string; saved: boolean }) {
  // Flip instantly; React reverts to the real `saved` prop if the action throws.
  const [optimisticSaved, setOptimisticSaved] = useOptimistic(saved, (_current, next: boolean) => next);

  async function action() {
    const next = !optimisticSaved;
    setOptimisticSaved(next);
    await setListingSaved(id, next);
  }

  return (
    <form action={action}>
      <button type="submit" className={styles.save} aria-pressed={optimisticSaved}>
        {optimisticSaved ? "★ Saved" : "☆ Save"}
      </button>
    </form>
  );
}
