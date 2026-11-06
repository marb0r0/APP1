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

function isPredictionEntry(item: unknown): item is PredictionEntry {
  if (!item || typeof item !== "object") return false;
  const candidate = item as Partial<PredictionEntry>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.fixture === "string" &&
    typeof candidate.league === "string" &&
    typeof candidate.modelProbability === "number" && Number.isFinite(candidate.modelProbability) && candidate.modelProbability >= 0 && candidate.modelProbability <= 1 &&
    typeof candidate.marketOdds === "number" && Number.isFinite(candidate.marketOdds) && candidate.marketOdds > 1 &&
    typeof candidate.stake === "number" && Number.isFinite(candidate.stake) && candidate.stake >= 0 &&
    (candidate.result === "pending" || candidate.result === "won" || candidate.result === "lost") &&
    typeof candidate.notes === "string" &&
    typeof candidate.createdAt === "string"
  );
}

function readEntries(): PredictionEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isPredictionEntry) : [];
  } catch {
    return [];
  }
}

function makeId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function PredictionTrackerPage() {
  const [entries, setEntries] = useState<PredictionEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [fixture, setFixture] = useState("");
  const [league, setLeague] = useState("");
  const [probability, setProbability] = useState(0.52);
  const [odds, setOdds] = useState(2.2);
  const [stake, setStake] = useState(15);
  const [result, setResult] = useState<PredictionResult>("pending");
  const [notes, setNotes] = useState("");
  const [storageError, setStorageError] = useState(false);

  const summary = useMemo(() => summarizePredictions(entries), [entries]);
  const enteredProbability = Number.isFinite(probability) ? clampProbability(probability) : 0;
  const enteredOdds = Number.isFinite(odds) && odds > 1 ? odds : 0;
  const currentEdge = enteredOdds > 1 ? calculateEdge(enteredProbability, enteredOdds) : null;

  useEffect(() => {
    setEntries(readEntries());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [entries, hydrated]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanFixture = fixture.trim();
    const cleanLeague = league.trim();
    if (!cleanFixture || !cleanLeague || !Number.isFinite(probability) || probability < 0 || probability > 1 || !Number.isFinite(odds) || odds <= 1 || !Number.isFinite(stake) || stake <= 0) return;

    const nextEntry: PredictionEntry = {
      id: makeId(),
      fixture: cleanFixture,
      league: cleanLeague,
      modelProbability: probability,
      marketOdds: odds,
      stake,
      result,
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
    };

    setEntries((current) => [nextEntry, ...current]);
    setFixture("");
    setLeague("");
    setProbability(0.5);
    setOdds(2);
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
        <MetricCard label="Win rate" value={summary.closed ? `${(summary.winRate * 100).toFixed(1)}%` : "—"} accent="text-primary" />
        <MetricCard label="ROI" value={summary.closed ? `${summary.roi.toFixed(1)}%` : "—"} accent="text-gold" />
        <MetricCard label="Lucro líquido" value={`€${summary.netProfit.toFixed(2)}`} accent={summary.netProfit >= 0 ? "text-emerald-400" : "text-live"} />
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-[380px,1fr]">
        <form onSubmit={handleSubmit} className="rounded-2xl border border-line bg-surface p-4">
          <h2 className="font-display text-xl font-bold text-fg">Adicionar previsão</h2>
          <p className="mt-1 text-xs text-muted">Registe a probabilidade da seleção escolhida, não apenas a probabilidade do resultado 1X2.</p>
          <div className="mt-4 space-y-3 text-sm">
            <label className="block text-muted">
              Jogo / seleção
              <input required value={fixture} onChange={(event) => setFixture(event.target.value)} maxLength={140} className="mt-1 block w-full rounded-xl border border-line bg-bg px-3 py-2 text-fg focus:border-primary focus:outline-none" placeholder="Ex.: Porto vence" />
            </label>
            <label className="block text-muted">
              Liga
              <input required value={league} onChange={(event) => setLeague(event.target.value)} maxLength={80} className="mt-1 block w-full rounded-xl border border-line bg-bg px-3 py-2 text-fg focus:border-primary focus:outline-none" placeholder="Ex.: Liga Portugal" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-muted">
                Prob. modelo (0–1)
                <input required type="number" min="0" max="1" step="0.01" value={probability} onChange={(event) => setProbability(event.target.value === "" ? Number.NaN : Number(event.target.value))} className="mt-1 block w-full rounded-xl border border-line bg-bg px-3 py-2 text-fg focus:border-primary focus:outline-none" />
              </label>
              <label className="block text-muted">
                Odd decimal
                <input required type="number" min="1.01" step="0.01" value={odds} onChange={(event) => setOdds(event.target.value === "" ? Number.NaN : Number(event.target.value))} className="mt-1 block w-full rounded-xl border border-line bg-bg px-3 py-2 text-fg focus:border-primary focus:outline-none" />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-muted">
                Stake (€)
                <input required type="number" min="0.01" step="0.01" value={stake} onChange={(event) => setStake(event.target.value === "" ? Number.NaN : Number(event.target.value))} className="mt-1 block w-full rounded-xl border border-line bg-bg px-3 py-2 text-fg focus:border-primary focus:outline-none" />
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
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} rows={3} className="mt-1 block w-full rounded-xl border border-line bg-bg px-3 py-2 text-fg focus:border-primary focus:outline-none" placeholder="Contexto da seleção e fonte das odds" />
            </label>
          </div>

          <div className="mt-5 rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs text-muted">
            Edge teórico (antes de comissões): <strong className="font-mono text-fg">{currentEdge === null ? "—" : `${(currentEdge * 100).toFixed(1)}%`}</strong>
          </div>
          {storageError && <p role="alert" className="mt-3 text-xs text-live">Não foi possível guardar no armazenamento local deste navegador.</p>}
          <button type="submit" disabled={!fixture.trim() || !league.trim() || !Number.isFinite(probability) || probability < 0 || probability > 1 || !Number.isFinite(odds) || odds <= 1 || !Number.isFinite(stake) || stake <= 0} className="mt-5 w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-ink hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">Guardar previsão</button>
        </form>

        <div className="rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
            <h2 className="font-display text-xl font-bold text-fg">Resumo</h2>
            <span className="rounded-full border border-line bg-bg px-2.5 py-1 text-[10px] uppercase tracking-wider text-muted">{summary.closed} fechadas · {summary.total} total</span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <MiniStat label="Aproveitamento" value={summary.closed ? `${(summary.winRate * 100).toFixed(1)}%` : "—"} />
            <MiniStat label="Edge médio" value={summary.closed ? `${(summary.averageEdge * 100).toFixed(1)}%` : "—"} />
            <MiniStat label="Stake média" value={summary.closed ? `€${summary.averageStake.toFixed(2)}` : "—"} />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <MiniStat label="Brier score (seleções fechadas)" value={summary.closed ? summary.brierScore.toFixed(3) : "—"} />
            <MiniStat label="Lucro / perda realizados" value={`€${summary.netProfit.toFixed(2)}`} />
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted">Amostra de {summary.closed} seleções fechadas. ROI e taxa de acerto históricos não garantem resultados futuros; o Brier Score só é comparável para previsões do mesmo tipo de mercado.</p>

          <div className="mt-5 overflow-x-auto rounded-xl border border-line">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-bg text-[10px] uppercase tracking-wider text-muted">
                <tr><th className="px-3 py-2">Seleção</th><th className="px-3 py-2">Prob.</th><th className="px-3 py-2">Odd</th><th className="px-3 py-2">Stake</th><th className="px-3 py-2">Estado</th><th className="px-3 py-2">P&amp;L</th><th className="px-3 py-2" /></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {entries.length ? entries.map((entry) => (
                  <tr key={entry.id} className="align-top">
                    <td className="px-3 py-2.5"><div className="font-semibold text-fg">{entry.fixture}</div><div className="text-[10px] text-muted">{entry.league}</div><div className="mt-1 text-[10px] text-muted">{new Date(entry.createdAt).toLocaleDateString("pt-PT")}{entry.notes ? ` · ${entry.notes}` : ""}</div></td>
                    <td className="px-3 py-2.5 font-mono text-fg">{(entry.modelProbability * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2.5 font-mono text-fg">{entry.marketOdds.toFixed(2)}</td>
                    <td className="px-3 py-2.5 font-mono text-gold">€{entry.stake.toFixed(2)}</td>
                    <td className="px-3 py-2.5"><select aria-label={`Resultado de ${entry.fixture}`} value={entry.result} onChange={(event) => updateResult(entry.id, event.target.value as PredictionResult)} className="rounded border border-line bg-bg px-2 py-1 text-[10px] text-fg focus:border-primary focus:outline-none"><option value="pending">Pendente</option><option value="won">Ganhou</option><option value="lost">Perdeu</option></select></td>
                    <td className="px-3 py-2.5 font-mono text-fg">{entry.result === "pending" ? "—" : `€${(entry.result === "won" ? entry.stake * (entry.marketOdds - 1) : -entry.stake).toFixed(2)}`}</td>
                    <td className="px-3 py-2.5"><button type="button" onClick={() => removeEntry(entry.id)} className="text-[10px] text-muted hover:text-live">Apagar</button></td>
                  </tr>
                )) : <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-muted">Ainda não há previsões guardadas.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}

function MetricCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return <article className="rounded-2xl border border-line bg-surface p-4"><p className="text-[10px] uppercase tracking-[0.2em] text-muted">{label}</p><p className={`mt-2 font-display text-2xl font-bold ${accent}`}>{value}</p></article>;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-line bg-bg p-3"><p className="text-[10px] uppercase tracking-[0.2em] text-muted">{label}</p><p className="mt-2 font-display text-xl font-bold text-fg">{value}</p></div>;
}
