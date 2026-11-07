import { useEffect, useState } from "react";
import type { MarketRow } from "./agents.types";

export function useAgents() {
  const [rows, setRows] = useState<MarketRow[]>([]);

  useEffect(() => {
    setRows([]);
  }, []);

  return {
    rows,
    setRows,
  };
}
