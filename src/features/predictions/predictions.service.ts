export type PredictionEntry = {
  id: string;
  fixture: string;
  league: string;
  market?: string;
  modelProbability: number;
  marketOdds: number;
  closingOdds?: number;
  stake: number;
  result: "pending" | "won" | "lost" | "void";
  notes: string;
  createdAt: string;
  oddsSource?: string;
};

export type PredictionResult = "pending" | "won" | "lost" | "void";

export function readEntries() {
  return [] as PredictionEntry[];
}

export function saveEntries(_entries: PredictionEntry[]) {
  return;
}
