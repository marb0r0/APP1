import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bot, BrainCircuit, CheckCircle2, ChevronLeft, HeartPulse, RefreshCw, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { getAiCoachReport, type CoachReportResponse } from "@/lib/coach.functions";
import {
  computeAcwr,
  formFingerprint,
  readResults,
  readSessions,
  sampleMonth,
  writeResults,
  writeSessions,
  type ResultMark,
  type Session,
} from "@/lib/footlab";

export const Route = createFileRoute("/lab")({
  component: Lab,
});

function Lab() {
  const fetchCoachReport = useServerFn(getAiCoachReport);

  const [sessions, setSessions] = useState<Session[]>(() => readSessions());
  const [results, setResults] = useState<ResultMark[]>(() => readResults());
  const [minutes, setMinutes] = useState(75);
  const [intensity, setIntensity] = useState(7);
  const [opponent, setOpponent] = useState("");
  const [mark, setMark] = useState<ResultMark["result"]>("W");

  // FootStats-AI Autonomous Coach State
  const [coachReport, setCoachReport] = useState<CoachReportResponse | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachError, setCoachError] = useState<string | null>(null);

  const acwr = useMemo(() => computeAcwr(sessions), [sessions]);
  const print = useMemo(() => formFingerprint(results), [results]);

  function addSession() {
    const next = [
      {
        id: crypto.randomUUID(),
        date: new Date().toISOString().slice(0, 10),
        minutes,
        intensity,
      },
      ...sessions,
    ];
    writeSessions(next);
    setSessions(next);
  }

  function addResult() {
    if (!opponent.trim()) return;
    const next = [
      ...results,
      {
        id: crypto.randomUUID(),
        date: new Date().toISOString().slice(0, 10),
        result: mark,
        opponent: opponent.trim(),
      },
    ];
    writeResults(next);
    setResults(next);
    setOpponent("");
  }

  function loadSample() {
    const next = sampleMonth();
    writeSessions(next);
    setSessions(next);
  }

  async function handleConsultCoach() {
    setCoachLoading(true);
    setCoachError(null);
    try {
      const recent = results.slice(-5).map((r) => `${r.result} vs ${r.opponent}`);
      const data = await fetchCoachReport({
        data: {
          acwr: acwr.acwr,
          acute: acwr.acute,
          chronic: acwr.chronic,
          sessionsCount: sessions.length,
          recentResults: recent,
        },
      });
      setCoachReport(data);
    } catch (err) {
      setCoachError(err instanceof Error ? err.message : "Erro ao consultar o Treinador IA.");
    } finally {
      setCoachLoading(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 pb-20 pt-6 sm:px-6">
      {/* Top Header */}
      <header className="border-b border-line pb-5">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary uppercase tracking-wider hover:underline"
          >
            <ChevronLeft size={14} />
            <span>Voltar ao Match Desk (Pitchline)</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="rounded bg-primary/10 px-2 py-0.5 text-[11px] font-mono text-primary font-semibold">
              FootStats-AI Integrated
            </span>
          </div>
        </div>
        <h1 className="font-display mt-3 text-3xl font-bold text-fg sm:text-4xl">
          FootStats Lab: Fisiologia & Treinador IA
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted max-w-2xl">
          Port do repositório FootStats-AI. Monitorização de fadiga e carga aguda:crónica (ACWR),
          prevenção de lesões e agente tático autónomo impulsionado por Gemini.
        </p>
      </header>

      {/* AI Coach Banner / Report */}
      <section className="mt-6 rounded-2xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-line">
          <div className="flex items-center gap-2">
            <Bot size={20} className="text-primary" />
            <h2 className="font-display text-lg font-bold text-fg">
              Treinador Tático Autónomo (FootStats-AI)
            </h2>
          </div>
          <button
            type="button"
            onClick={handleConsultCoach}
            disabled={coachLoading}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-ink hover:opacity-90 transition-opacity"
          >
            {coachLoading ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
            <span>{coachLoading ? "A analisar dados..." : "Consultar Treinador IA"}</span>
          </button>
        </div>

        {coachError && (
          <p className="mt-3 rounded-lg border border-line bg-bg p-3 text-xs text-live">{coachError}</p>
        )}

        {coachReport ? (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-display text-base font-bold text-fg">{coachReport.headline}</span>
              <span
                className={`rounded px-2 py-0.5 text-[11px] font-mono font-bold ${
                  coachReport.injuryRiskLevel === "BAIXO"
                    ? "bg-primary/20 text-primary"
                    : coachReport.injuryRiskLevel === "MODERADO"
                      ? "bg-gold/20 text-gold"
                      : "bg-live/20 text-live"
                }`}
              >
                Risco de Lesão: {coachReport.injuryRiskLevel}
              </span>
            </div>

            <p className="text-xs text-muted leading-relaxed bg-bg rounded-xl p-3 border border-line">
              {coachReport.workloadVerdict}
            </p>

            <div className="space-y-1.5 pt-1">
              <p className="text-xs font-semibold text-fg">Diretrizes Táticas:</p>
              {coachReport.tacticalAdvice.map((advice, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-muted">
                  <CheckCircle2 size={13} className="text-primary mt-0.5 shrink-0" />
                  <span>{advice}</span>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs">
              <p className="font-semibold text-primary">Prescrição Imediata:</p>
              <p className="mt-0.5 text-fg">{coachReport.keyPrescription}</p>
            </div>

            <p className="text-[10px] text-muted font-mono text-right pt-1">
              Motor: {coachReport.modelUsed}
            </p>
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-muted">
            <BrainCircuit size={28} className="mx-auto text-muted/50 mb-2" />
            <p>
              Clique em <strong>"Consultar Treinador IA"</strong> para gerar o diagnóstico biométrico
              completo e recomendações táticas baseadas no ACWR atual.
            </p>
          </div>
        )}
      </section>

      {/* Acute / Chronic Workload Ratio (ACWR) */}
      <section className="mt-6 rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold tracking-wider text-muted uppercase">
            Carga Aguda / Crónica (ACWR)
          </p>
          <span className="text-[11px] font-mono text-muted">Gabbett 2016 Model</span>
        </div>

        <div className="mt-3 flex flex-wrap items-baseline gap-4">
          <p className="font-display text-5xl font-bold font-mono text-fg">{acwr.acwr.toFixed(2)}</p>
          <div>
            <p className="text-sm font-semibold text-primary">{acwr.flag.replace("_", " ")}</p>
            <p className="text-xs text-muted">
              Carga Aguda (7d): <strong className="text-fg">{acwr.acute}</strong> · Crónica (28d):{" "}
              <strong className="text-fg">{acwr.chronic}</strong>
            </p>
          </div>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-muted bg-bg p-3 rounded-xl border border-line">
          {acwr.message} (Faixa segura / Sweet Spot: <strong>0.80 a 1.30</strong>. Acima de 1.50
          indica sobrecarga exponencial).
        </p>

        {/* Visual scale bar */}
        <div className="mt-4 space-y-1">
          <div className="flex justify-between text-[10px] font-mono text-muted">
            <span>0.5 (Subtreino)</span>
            <span className="text-primary font-bold">0.8 - 1.3 (Sweet Spot)</span>
            <span className="text-live font-bold">&gt; 1.5 (Perigo)</span>
          </div>
          <div className="h-2 rounded-full bg-bg overflow-hidden relative">
            <div
              className={`h-full transition-all duration-300 ${
                acwr.acwr > 1.45 ? "bg-live" : acwr.acwr < 0.8 ? "bg-gold" : "bg-primary"
              }`}
              style={{ width: `${Math.min(100, (acwr.acwr / 2.0) * 100)}%` }}
            />
          </div>
        </div>

        {/* Log Session Form */}
        <div className="mt-5 pt-4 border-t border-line">
          <p className="text-xs font-semibold text-fg mb-3">Registar Sessão de Treino:</p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-muted">
              Duração (min)
              <input
                type="number"
                min={10}
                max={180}
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
                className="mt-1 block h-10 w-24 rounded-lg border border-line bg-bg px-3 text-xs text-fg focus:border-primary focus:outline-none"
              />
            </label>
            <label className="text-xs text-muted">
              Intensidade RPE (1–10)
              <input
                type="number"
                min={1}
                max={10}
                value={intensity}
                onChange={(e) => setIntensity(Number(e.target.value))}
                className="mt-1 block h-10 w-24 rounded-lg border border-line bg-bg px-3 text-xs text-fg focus:border-primary focus:outline-none"
              />
            </label>
            <button
              type="button"
              onClick={addSession}
              className="h-10 rounded-lg bg-primary px-4 text-xs font-bold text-primary-ink hover:opacity-90 transition-opacity"
            >
              Registar Treino
            </button>
            <button
              type="button"
              onClick={loadSample}
              className="h-10 rounded-lg border border-line bg-surface-2 px-4 text-xs font-semibold text-fg hover:border-gold transition-colors"
            >
              Carregar Mês de Exemplo
            </button>
          </div>
        </div>
      </section>

      {/* Form Fingerprint & Results Logger */}
      <section className="mt-5 rounded-2xl border border-line bg-surface p-5">
        <p className="text-xs font-semibold tracking-wider text-muted uppercase">
          Form Fingerprint & Histórico
        </p>
        <p className="mt-1 text-xs text-muted">
          {print
            ? `Os últimos 5 jogos correspondem a uma sequência de ${print.since} com ${print.similarity}% de similaridade.`
            : "Registe pelo menos 10 resultados para comparar a sequência atual com o histórico."}
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3 pt-3 border-t border-line">
          <label className="text-xs text-muted">
            Adversário
            <input
              placeholder="ex: FC Porto"
              value={opponent}
              onChange={(e) => setOpponent(e.target.value)}
              className="mt-1 block h-10 w-44 rounded-lg border border-line bg-bg px-3 text-xs text-fg focus:border-primary focus:outline-none"
            />
          </label>
          <label className="text-xs text-muted">
            Resultado
            <select
              value={mark}
              onChange={(e) => setMark(e.target.value as ResultMark["result"])}
              className="mt-1 block h-10 rounded-lg border border-line bg-bg px-3 text-xs text-fg focus:border-primary focus:outline-none"
            >
              <option value="W">Vitória (W)</option>
              <option value="D">Empate (D)</option>
              <option value="L">Derrota (L)</option>
            </select>
          </label>
          <button
            type="button"
            onClick={addResult}
            className="h-10 rounded-lg bg-primary px-4 text-xs font-bold text-primary-ink hover:opacity-90 transition-opacity"
          >
            Registar Jogo
          </button>
        </div>

        <ul className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {results
            .slice()
            .reverse()
            .slice(0, 8)
            .map((r) => (
              <li
                key={r.id}
                className="rounded-lg border border-line bg-bg p-2 text-center font-mono"
              >
                <span
                  className={`inline-block font-bold mr-1.5 ${
                    r.result === "W"
                      ? "text-primary"
                      : r.result === "D"
                        ? "text-gold"
                        : "text-live"
                  }`}
                >
                  {r.result}
                </span>
                <span className="text-fg">{r.opponent}</span>
                <span className="block text-[10px] text-muted mt-0.5">{r.date}</span>
              </li>
            ))}
        </ul>
      </section>
    </main>
  );
}
