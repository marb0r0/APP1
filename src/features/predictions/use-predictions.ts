import { useEffect, useState } from "react";
import type { PredictionEntry } from "./predictions.types";

export function usePredictions() {
  const [entries, setEntries] = useState<PredictionEntry[]>([]);

  useEffect(() => {
    setEntries([]);
  }, []);

  return {
    entries,
    setEntries,
  };
}
