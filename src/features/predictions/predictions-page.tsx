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

export function PredictionsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 text-fg">
      <h1 className="font-display text-3xl font-bold">Predictions</h1>
      <p className="mt-2 text-sm text-muted">
        Feature scaffold for the prediction tracker flow. Extract the current route logic here as the migration progresses.
      </p>
    </div>
  );
}
