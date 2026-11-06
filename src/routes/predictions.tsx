import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  calculateEdge,
  clampProbability,
  summarizePredictions,
  type PredictionEntry,
  type PredictionResult,
} from "@/lib/prediction-tracker";

export const Route = createFileRoute("/predictions")({
  component: PredictionTrackerPage,
});

const STORAGE_KEY = "pitchline-prediction-history-v1";

function readEntries(): PredictionEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is PredictionEntry => {
      if (!item || typeof item !== "object") return false;
      const candidate = item as Partial<PredictionEntry>;
      return (
        typeof candidate.id === "string" &&
        typeof candidate.fixture === "string" &&
        typeof candidate.league === "string" &&
        typeof candidate.modelProbability === "number" &&
        typeof candidate.marketOdds === "number" &&
        typeof candidate.stake === "number" &&
        (candidate.result === "pending" || candidate.result === "won" || candidate.result === "lost") &&
        typeof candidate.createdAt === "string"
      );
    });
  } catch {
    return [];
  }
}

function PredictionTrackerPage() {
  const [entries, setEntries] = useState<PredictionEntry[]>([]);
  const [fixture, setFixture] = useState("Real Madrid vs Barcelona");
  const [league, setLeague] = useState("La Liga");
  const [probability, setProbability] = useState(0.52);
  const [odds, setOdds] = useState(2.2);
  const [stake, setStake] = useState(15);
  const [result, setResult] = useState<PredictionResult>("pending");
  const [notes, setNotes] = useState("");

  const summary = useMemo(() => summarizePredictions(entries), [entries]);

  useEffect(() => {
    setEntries(readEntries());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // Ignore storage errors to keep the UI usable.
    }
  }, [entries]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const safeProbability = clampProbability(Number(probability) || 0);
    const safeOdds = Number(odds) > 1 ? Number(odds) : 1.01;
    const safeStake = Number(stake) > 0 ? Number(stake) : 0;
    if (!fixture.trim() || !league.trim() || safeStake <= 0) return;

    const nextEntry: PredictionEntry = {
      id: crypto.randomUUID(),
      fixture: fixture.trim(),
      league: league.trim(),
      modelProbability: safeProbability,
      marketOdds: safeOdds,
      stake: safeStake,
      result,
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
    };

    setEntries((current) => [nextEntry, ...current]);
    setFixture("");
    setLeague("La Liga");
    setProbability(0.5);
    setOdds(2.0);
    setStake(10);
    setResult("pending");
    setNotes("");
  }

  function updateResult(id: string, nextResult: PredictionResult) {
    setEntries((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, result: nextResult } : entry)),
    );
  }

  function removeEntry(id: string) {
    setEntries((current) => current.filter((entry) => entry.id !== id));
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 pb-20 pt-8 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-5">
        <div>
          <Link to="/" className="text-xs font-semibold text-primary hover:underline">← Voltar ao Pitchline</Link>
          <p className="mt-3 text-xs uppercase tracking-widest text-primary">Registo de previsões</p>
          <h1 className="mt-1 font-display text-3xl font-bold text-fg sm:text-4xl">Histórico do tipster</h1>
        </div>
        <Link to="/agents" className="rounded-full border border-line bg-surface px-4 py-2 text-xs font-bold text-fg hover:border-primary hover:text-primary">Agentes</Link>
      </header>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <MetricCard label="Previsões" value={String(summary.total)} accent="text-fg" />
        <MetricCard label="Win rate" value={`${(summary.winRate * 100).toFixed(1)}%`} accent="text-primary" />
        <MetricCard label="ROI" value={`${summary.roi.toFixed(1)}%`} accent="text-gold" />
        <MetricCard label="Lucro líquido" value={`€${summary.netProfit.toFixed(2)}`} accent={summary.netProfit >= 0 ? "text-emerald-400" : "text-live"} />
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-[380px,1fr]">
        <form onSubmit={handleSubmit} className="rounded-2xl border border-line bg-surface p-4">
          <h2 className="font-display text-xl font-bold text-fg">Adicionar previsão</h2>
          <div className="mt-4 space-y-3 text-sm">
            <label className="block text-muted">
              Jogo
              <input value={fixture} onChange={(event) => setFixture(event.target.value)} className="mt-1 block w-full rounded-xl border border-line bg-bg px-3 py-2 text-fg focus:border-primary focus:outline-none" placeholder="Ex.: Porto vs Benfica" />
            </label>
            <label className="block text-muted">
              Liga
              <input value={league} onChange={(event) => setLeague(event.target.value)} className="mt-1 block w-full rounded-xl border border-line bg-bg px-3 py-2 text-fg focus:border-primary focus:outline-none" placeholder="Ex.: Liga Portugal" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-muted">
                Prob. modelo
                <input type="number" min="0" max="1" step="0.01" value={probability} onChange={(event) => setProbability(Number(event.target.value))} className="mt-1 block w-full rounded-xl border border-line bg-bg px-3 py-2 text-fg focus:border-primary focus:outline-none" />
              </label>
              <label className="block text-muted">
                Odd
                <input type="number" min="1.01" step="0.01" value={odds} onChange={(event) => setOdds(Number(event.target.value))} className="mt-1 block w-full rounded-xl border border-line bg-bg px-3 py-2 text-fg focus:border-primary focus:outline-none" />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-muted">
                Stake (€)
                <input type="number" min="0" step="1" value={stake} onChange={(event) => setStake(Number(event.target.value))} className="mt-1 block w-full rounded-xl border border-line bg-bg px-3 py-2 text-fg focus:border-primary focus:outline-none" />
              </label>
              <label className="block text-muted">
                Estado
                <select value={result} onChange={(event) => setResult(event.target.value as PredictionResult)} className="mt-1 block w-full rounded-xl border border-line bg-bg px-3 py-2 text-fg focus:border-primary focus:outline-none">
                  <option value="pending">Pendente</option>
                  <option value="won">Ganhou</option>
                  <option value="lost">Perdeu</option>
                </select>
              </label>
            </div>
            <label className="block text-muted">
              Nota
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="mt-1 block w-full rounded-xl border border-line bg-bg px-3 py-2 text-fg focus:border-primary focus:outline-none" placeholder="Ex.: valor em mercado, lesões, desvio de linha..." />
            </label>
          </div>

          <div className="mt-5 rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs text-muted">
            Edge estimado: <strong className="font-mono text-fg">{((calculateEdge(safeProbability(), Number(odds) || 1) * 100) || 0).toFixed(1)}%</strong>
          </div>

          <button type="submit" className="mt-5 w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-ink hover:opacity-90">Guardar previsão</button>
        </form>

        <div className="rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
            <h2 className="font-display text-xl font-bold text-fg">Resumo</h2>
            <span className="rounded-full border border-line bg-bg px-2.5 py-1 text-[10px] uppercase tracking-wider text-muted">
              {summary.closed} fechadas
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <MiniStat label="Aproveitamento" value={`${(summary.winRate * 100).toFixed(1)}%`} />
            <MiniStat label="Edge médio" value={`${(summary.averageEdge * 100).toFixed(1)}%`} />
            <MiniStat label="Stake média" value={`€${summary.averageStake.toFixed(2)}`} />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <MiniStat label="Brier score" value={summary.brierScore.toFixed(3)} />
            <MiniStat label="Lucro / perda" value={`€${summary.netProfit.toFixed(2)}`} />
          </div>

          <div className="mt-5 overflow-x-auto rounded-xl border border-line">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-bg text-[10px] uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-3 py-2">Jogo</th>
                  <th className="px-3 py-2">Prob.</th>
                  <th className="px-3 py-2">Odd</th>
                  <th className="px-3 py-2">Stake</th>
                  <th className="px-3 py-2">Resultado</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {entries.length ? (
                  entries.map((entry) => (
                    <tr key={entry.id} className="align-top">
                      <td className="px-3 py-2.5">
                        <div className="font-semibold text-fg">{entry.fixture}</div>
                        <div className="text-[10px] text-muted">{entry.league}</div>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-fg">{(entry.modelProbability * 100).toFixed(1)}%</td>
                      <td className="px-3 py-2.5 font-mono text-fg">{entry.marketOdds.toFixed(2)}</td>
                      <td className="px-3 py-2.5 font-mono text-gold">€{entry.stake.toFixed(2)}</td>
                      <td className="px-3 py-2.5">
                        <select value={entry.result} onChange={(event) => updateResult(entry.id, event.target.value as PredictionResult)} className="rounded border border-line bg-bg px-2 py-1 text-[10px] text-fg focus:border-primary focus:outline-none">
                          <option value="pending">Pendente</option>
                          <option value="won">Ganhou</option>
                          <option value="lost">Perdeu</option>
                        </select>
                      </td>
                      <td className="px-3 py-2.5">
                        <button type="button" onClick={() => removeEntry(entry.id)} className="text-[10px] text-muted hover:text-live">Apagar</button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-sm text-muted">Ainda não há previsões guardadas.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}

function safeProbability() {
  return clampProbability(Number(probability) || 0);
}

function MetricCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <article className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted">{label}</p>
      <p className={`mt-2 font-display text-2xl font-bold ${accent}`}>{value}</p>
    </article>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-bg p-3">
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted">{label}</p>
      <p className="mt-2 font-display text-xl font-bold text-fg">{value}</p>
    </div>
  );
}
