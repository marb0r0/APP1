import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  BarChart3,
  Calculator,
  ChevronRight,
  Flame,
  Globe,
  LineChart,
  Radio,
  RefreshCw,
  Search,
  ShieldAlert,
  Sliders,
  Sparkles,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { computeAlphaPySignals } from "@/lib/alphapy";
import { getBoard, getTable } from "@/lib/football.functions";
import type { Board, LeagueTable, MatchView, Phase } from "@/lib/football";
import {
  getTopScorelines,
  scoreMatrix,
  simulateMatch,
  type SimulationStats,
} from "@/lib/football";
import {
  BENCHMARK_MATCHES,
  removeVig,
  runBacktest,
  type BacktestSummary,
  type DevigMethod,
  type StakingStrategy,
} from "@/lib/sports-betting";
import { sportFlow, valuePicks } from "@/lib/value";

export const Route = createFileRoute("/")({
  loader: () => getBoard({ data: { offset: 0 } }),
  component: Home,
});

const DAYS = [
  { offset: -1, labelEn: "Yesterday", labelPt: "Ontem" },
  { offset: 0, labelEn: "Today", labelPt: "Hoje" },
  { offset: 1, labelEn: "Tomorrow", labelPt: "Amanhã" },
  { offset: 2, labelEn: "+2 Days", labelPt: "+2 Dias" },
  { offset: 3, labelEn: "+3 Days", labelPt: "+3 Dias" },
];

const TABLE_LEAGUES = [
  // Competições Europeias (UEFA)
  ["uefa.champions", "Champions League", "UEFA"],
  ["uefa.europa", "Europa League", "UEFA"],
  ["uefa.europa.conf", "Conference League", "UEFA"],

  // Competições Sul-Americanas (CONMEBOL & Nacionais)
  ["conmebol.libertadores", "Copa Libertadores", "América do Sul"],
  ["conmebol.sudamericana", "Copa Sul-Americana", "América do Sul"],
  ["bra.1", "Brasileirão Série A", "América do Sul"],
  ["arg.1", "Campeonato Argentino", "América do Sul"],

  // Ligas Europeias
  ["por.1", "Liga Portugal", "Ligas"],
  ["esp.1", "La Liga", "Ligas"],
  ["eng.1", "Premier League", "Ligas"],
  ["ita.1", "Serie A", "Ligas"],
  ["ger.1", "Bundesliga", "Ligas"],
  ["fra.1", "Ligue 1", "Ligas"],
  ["ned.1", "Eredivisie", "Ligas"],
  ["eng.2", "Championship", "Ligas"],
] as const;

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function kickLabel(iso: string, locale: "pt" | "en") {
  if (!iso) return "TBD";
  const d = new Date(iso);
  return d.toLocaleString(locale === "pt" ? "pt-PT" : "en-GB", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Home() {
  const initial = Route.useLoaderData() as Board;
  const fetchBoard = useServerFn(getBoard);
  const fetchTable = useServerFn(getTable);

  const [lang, setLang] = useState<"pt" | "en">("pt");
  const [offset, setOffset] = useState(0);
  const [board, setBoard] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [league, setLeague] = useState("all");
  const [phase, setPhase] = useState<"all" | Phase>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [onlyValue, setOnlyValue] = useState(false);
  const [selected, setSelected] = useState<string | null>(initial.matches[0]?.id ?? null);
  const [view, setView] = useState<"matches" | "table" | "value" | "simulator" | "backtest">("matches");
  const [tableLeague, setTableLeague] = useState("uefa.champions");
  const [tableRegion, setTableRegion] = useState("all");
  const [table, setTable] = useState<LeagueTable | null>(null);
  const [bankroll, setBankroll] = useState(250);

  // Simulator states
  const [simHomeTeam, setSimHomeTeam] = useState("Sporting CP");
  const [simAwayTeam, setSimAwayTeam] = useState("SL Benfica");
  const [simHomeXg, setSimHomeXg] = useState(1.85);
  const [simAwayXg, setSimAwayXg] = useState(1.25);
  const [simResults, setSimResults] = useState<SimulationStats | null>(() =>
    simulateMatch(1.85, 1.25, 10000)
  );

  // sports-betting Backtest states
  const [backtestStrategy, setBacktestStrategy] = useState<StakingStrategy>("quarter_kelly");
  const [backtestStartBankroll, setBacktestStartBankroll] = useState(500);
  const [backtestMinEdge, setBacktestMinEdge] = useState(0.02);
  const [backtestResult, setBacktestResult] = useState<BacktestSummary | null>(() =>
    runBacktest(BENCHMARK_MATCHES, 500, "quarter_kelly", 0.02)
  );

  // De-Vig Calculator states
  const [devigH, setDevigH] = useState(2.15);
  const [devigD, setDevigD] = useState(3.40);
  const [devigA, setDevigA] = useState(3.50);
  const [devigMethod, setDevigMethod] = useState<DevigMethod>("shin");

  const devigResult = useMemo(() => {
    return removeVig(devigH, devigD, devigA, devigMethod);
  }, [devigH, devigD, devigA, devigMethod]);

  async function load(next = offset) {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBoard({ data: { offset: next } });
      setBoard(data);
      setSelected((cur) =>
        data.matches.some((m) => m.id === cur) ? cur : data.matches[0]?.id ?? null
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : lang === "pt"
            ? "Falha ao atualizar jogos"
            : "Could not refresh fixtures"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (view !== "table") return;
    let cancelled = false;
    void fetchTable({ data: { leagueId: tableLeague } })
      .then((data) => {
        if (!cancelled) setTable(data);
      })
      .catch((e) => {
        if (!cancelled)
          setError(
            e instanceof Error
              ? e.message
              : lang === "pt"
                ? "Erro ao carregar tabela"
                : "Could not load table"
          );
      });
    return () => {
      cancelled = true;
    };
  }, [view, tableLeague, fetchTable, lang]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void load(offset);
    }, 90_000);
    return () => window.clearInterval(id);
  }, [offset]);

  const leagues = useMemo<string[]>(() => {
    const set = new Set(board.matches.map((m) => m.league));
    return ["all", ...Array.from(set)];
  }, [board.matches]);

  const picks = useMemo(() => valuePicks(board.matches, bankroll), [board.matches, bankroll]);

  const shown = useMemo(() => {
    return board.matches.filter((m) => {
      if (league !== "all" && m.league !== league) return false;
      if (phase !== "all" && m.phase !== phase) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = `${m.home} ${m.away} ${m.league}`.toLowerCase();
        if (!matchName.includes(q)) return false;
      }
      if (onlyValue) {
        const hasPick = picks.some((p) => p.match.includes(m.home) || p.match.includes(m.away));
        if (!hasPick) return false;
      }
      return true;
    });
  }, [board.matches, league, phase, searchQuery, onlyValue, picks]);

  const liveCount = board.matches.filter((m) => m.phase === "in").length;
  const pick = shown.find((m) => m.id === selected) ?? shown[0] ?? null;

  function handleRunSimulation() {
    const res = simulateMatch(simHomeXg, simAwayXg, 10000);
    setSimResults(res);
  }

  function handleRunBacktest() {
    const res = runBacktest(
      BENCHMARK_MATCHES,
      backtestStartBankroll,
      backtestStrategy,
      backtestMinEdge
    );
    setBacktestResult(res);
  }

  function handleLoadMatchIntoSimulator(m: MatchView) {
    setSimHomeTeam(m.home);
    setSimAwayTeam(m.away);
    setSimHomeXg(Number(m.homeXg.toFixed(2)));
    setSimAwayXg(Number(m.awayXg.toFixed(2)));
    setSimResults(simulateMatch(m.homeXg, m.awayXg, 10000));
    setView("simulator");
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 pb-20 pt-6 sm:px-6">
      {/* Top Bar Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-display text-sm font-semibold tracking-[0.2em] text-primary uppercase">
              Pitchline
            </span>
            <span className="text-xs text-muted">/</span>
            <span className="text-xs text-muted font-mono">
              AlphaPy + sports-betting + FootStats-AI
            </span>
          </div>
          <h1 className="font-display mt-1 text-3xl font-bold tracking-tight text-fg sm:text-4xl">
            {lang === "pt" ? "Central de Inteligência & Apostas de Futebol" : "Football Match Intelligence & Betting"}
          </h1>
          <p className="mt-1 text-xs text-muted">
            {lang === "pt"
              ? "Modelos Dixon-Coles, AlphaPy SportFlow, motor de backtesting sports-betting e Treinador FootStats-AI."
              : "Dixon-Coles modeling, AlphaPy SportFlow signals, sports-betting backtesting, and FootStats-AI coach."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Language Switch */}
          <button
            type="button"
            onClick={() => setLang(lang === "pt" ? "en" : "pt")}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-xs font-semibold text-fg hover:border-primary transition-colors"
          >
            <Globe size={14} className="text-primary" />
            <span className="uppercase">{lang}</span>
          </button>

          {/* Live indicator */}
          <span className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-xs font-medium text-fg">
            <Radio className={liveCount ? "text-live animate-pulse" : "text-muted"} size={14} />
            <span className="tabular-nums font-mono">{liveCount}</span>{" "}
            {lang === "pt" ? "ao vivo" : "live"}
          </span>

          {/* Foot Lab route link */}
          <Link
            to="/lab"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-xs font-medium text-fg hover:border-gold transition-colors"
          >
            <Sliders size={14} className="text-gold" />
            <span>{lang === "pt" ? "FootStats Lab & IA" : "FootStats Lab"}</span>
          </Link>

          {/* Refresh button */}
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-ink hover:opacity-90 transition-opacity"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>{lang === "pt" ? "Atualizar" : "Refresh"}</span>
          </button>
        </div>
      </header>

      {/* Main Navigation Views */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div className="flex flex-wrap gap-1.5 p-1 bg-surface rounded-xl border border-line">
          {(
            [
              [
                "matches",
                lang === "pt" ? "Jogos & Ao Vivo" : "Fixtures & Scores",
                <BarChart3 key="1" size={15} />,
              ],
              [
                "value",
                lang === "pt" ? "Scanner de Valor (+EV)" : "Value Scanner (+EV)",
                <Sparkles key="2" size={15} />,
              ],
              [
                "simulator",
                lang === "pt" ? "Simulador xG / Monte Carlo" : "Match Simulator",
                <Calculator key="3" size={15} />,
              ],
              [
                "backtest",
                lang === "pt" ? "Backtesting & De-Vig (sports-betting)" : "Backtesting (sports-betting)",
                <LineChart key="4" size={15} />,
              ],
              [
                "table",
                lang === "pt" ? "Classificações" : "Standings",
                <Trophy key="5" size={15} />,
              ],
            ] as const
          ).map(([id, label, icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors ${
                view === id
                  ? "bg-primary text-primary-ink shadow-sm"
                  : "text-muted hover:text-fg hover:bg-surface-2"
              }`}
            >
              {icon}
              <span>{label}</span>
              {id === "value" && picks.length > 0 && (
                <span className="ml-1 rounded bg-gold/20 text-gold px-1.5 py-0.2 text-[10px] font-mono">
                  {picks.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Global Bankroll setting for Value Bets */}
        {view === "value" && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted">{lang === "pt" ? "Banca (Bankroll):" : "Bankroll:"}</span>
            <div className="flex items-center rounded-lg border border-line bg-surface px-2.5 py-1">
              <span className="text-muted mr-1">€</span>
              <input
                type="number"
                min="10"
                max="100000"
                step="50"
                value={bankroll}
                onChange={(e) => setBankroll(Math.max(10, Number(e.target.value) || 10))}
                className="w-16 bg-transparent font-mono text-fg focus:outline-none tabular-nums"
              />
            </div>
          </div>
        )}
      </div>

      {/* Fixtures Toolbar (Only on matches view) */}
      {view === "matches" && (
        <div className="mt-4 space-y-3">
          {/* Days bar + Status Filter */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Days Tabs */}
            <div className="flex flex-wrap items-center gap-1">
              {DAYS.map((d) => (
                <button
                  key={d.offset}
                  type="button"
                  onClick={() => {
                    setOffset(d.offset);
                    void load(d.offset);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    offset === d.offset
                      ? "bg-surface-2 text-gold border border-gold/40"
                      : "text-muted hover:text-fg bg-surface border border-line"
                  }`}
                >
                  {lang === "pt" ? d.labelPt : d.labelEn}
                </button>
              ))}
            </div>

            {/* Match Status Filter */}
            <div className="flex items-center gap-1 bg-surface p-1 rounded-lg border border-line text-xs">
              {(
                [
                  ["all", lang === "pt" ? "Todos" : "All"],
                  ["in", lang === "pt" ? "Ao Vivo" : "Live"],
                  ["pre", lang === "pt" ? "Agendados" : "Upcoming"],
                  ["post", lang === "pt" ? "Terminados" : "Final"],
                ] as const
              ).map(([p, label]) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPhase(p)}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    phase === p ? "bg-surface-2 text-fg shadow-xs" : "text-muted hover:text-fg"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Search + League Filter + Value Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                type="text"
                placeholder={
                  lang === "pt"
                    ? "Filtrar por equipa, liga..."
                    : "Search fixtures or teams..."
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface py-1.5 pl-9 pr-3 text-xs text-fg placeholder:text-muted focus:border-primary focus:outline-none"
              />
            </div>

            {/* Value Filter Toggle */}
            <button
              type="button"
              onClick={() => setOnlyValue(!onlyValue)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                onlyValue
                  ? "bg-gold/15 text-gold border-gold/50"
                  : "bg-surface text-muted border-line hover:text-fg"
              }`}
            >
              <Flame size={13} />
              <span>{lang === "pt" ? "Apenas com +EV" : "+EV Only"}</span>
            </button>
          </div>

          {/* Leagues Horizontal Pills */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
            {leagues.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setLeague(name)}
                className={`shrink-0 px-3 py-1 rounded-md font-medium transition-colors ${
                  league === name
                    ? "bg-surface-2 text-fg border border-line"
                    : "text-muted hover:text-fg"
                }`}
              >
                {name === "all" ? (lang === "pt" ? "Todas as Ligas" : "All Leagues") : name}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-live">
          {error}
        </p>
      )}

      {/* VIEW: BACKTESTING & DE-VIG (georgedouzas/sports-betting) */}
      {view === "backtest" && (
        <div className="mt-5 space-y-5">
          {/* Header banner */}
          <div className="rounded-2xl border border-line bg-surface p-5">
            <div className="flex items-center gap-2 pb-2">
              <LineChart size={20} className="text-primary" />
              <h2 className="font-display text-xl font-bold text-fg">
                {lang === "pt" ? "Motor de Backtesting (sports-betting)" : "Sports-Betting Backtesting Engine"}
              </h2>
            </div>
            <p className="text-xs text-muted max-w-3xl leading-relaxed">
              {lang === "pt"
                ? "Implementação das métricas de simulação do pacote 'georgedouzas/sports-betting'. Avalie estratégias de Kelly Fracionário vs Stakes Fixos contra odds históricas reais com medição de Brier Score (calibração de probabilidade) e Max Drawdown."
                : "Implementation of simulation metrics from 'georgedouzas/sports-betting'. Evaluate Fractional Kelly vs Flat staking strategies against historical market odds with Brier score calibration."}
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(300px,1fr)_minmax(0,1.8fr)]">
            {/* Strategy Configuration */}
            <div className="rounded-2xl border border-line bg-surface p-5 space-y-4">
              <h3 className="text-xs font-bold text-primary uppercase tracking-wider">
                {lang === "pt" ? "Parâmetros da Estratégia" : "Strategy Settings"}
              </h3>

              <div>
                <label className="text-xs text-muted block mb-1">
                  {lang === "pt" ? "Estratégia de Staking:" : "Staking Method:"}
                </label>
                <select
                  value={backtestStrategy}
                  onChange={(e) => setBacktestStrategy(e.target.value as StakingStrategy)}
                  className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-xs text-fg focus:border-primary focus:outline-none"
                >
                  <option value="quarter_kelly">Quarter-Kelly (Recomendado - 25%)</option>
                  <option value="half_kelly">Half-Kelly (Moderado - 50%)</option>
                  <option value="full_kelly">Full Kelly (Agressivo - 100%)</option>
                  <option value="flat">Stake Fixo (2% da Banca Inicial)</option>
                  <option value="proportional">Proporcional (2.5% da Banca Atual)</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-muted block mb-1">
                  {lang === "pt" ? "Banca Inicial (€):" : "Starting Bankroll (€):"}
                </label>
                <input
                  type="number"
                  min="50"
                  max="10000"
                  step="50"
                  value={backtestStartBankroll}
                  onChange={(e) => setBacktestStartBankroll(Number(e.target.value) || 100)}
                  className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-xs text-fg font-mono focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-muted block mb-1">
                  {lang === "pt" ? "Edge Mínimo (+EV):" : "Minimum Edge:"}{" "}
                  <span className="font-mono text-gold font-bold">{pct(backtestMinEdge)}</span>
                </label>
                <input
                  type="range"
                  min="0.01"
                  max="0.10"
                  step="0.005"
                  value={backtestMinEdge}
                  onChange={(e) => setBacktestMinEdge(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <button
                type="button"
                onClick={handleRunBacktest}
                className="w-full rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-ink hover:opacity-90 transition-opacity"
              >
                {lang === "pt" ? "Executar Backtest" : "Run Backtest"}
              </button>

              {/* De-Vig Calculator Tool */}
              <div className="pt-4 border-t border-line space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-fg flex items-center gap-1.5">
                    <TrendingUp size={13} className="text-gold" />
                    <span>Calculadora De-Vig (Shin / Proporcional)</span>
                  </h4>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  <div>
                    <span className="text-[10px] text-muted block">Odd 1 (Casa)</span>
                    <input
                      type="number"
                      step="0.05"
                      value={devigH}
                      onChange={(e) => setDevigH(Number(e.target.value) || 1.1)}
                      className="w-full rounded border border-line bg-bg p-1.5 text-xs font-mono text-fg"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-muted block">Odd X (Empate)</span>
                    <input
                      type="number"
                      step="0.05"
                      value={devigD}
                      onChange={(e) => setDevigD(Number(e.target.value) || 1.1)}
                      className="w-full rounded border border-line bg-bg p-1.5 text-xs font-mono text-fg"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-muted block">Odd 2 (Fora)</span>
                    <input
                      type="number"
                      step="0.05"
                      value={devigA}
                      onChange={(e) => setDevigA(Number(e.target.value) || 1.1)}
                      className="w-full rounded border border-line bg-bg p-1.5 text-xs font-mono text-fg"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted">Método:</span>
                  <select
                    value={devigMethod}
                    onChange={(e) => setDevigMethod(e.target.value as DevigMethod)}
                    className="rounded border border-line bg-bg px-2 py-1 text-xs text-fg"
                  >
                    <option value="shin">Shin's Model (Insider Bias)</option>
                    <option value="multiplicative">Multiplicativo Padrão</option>
                  </select>
                </div>

                <div className="rounded-lg bg-bg p-2.5 text-xs space-y-1 font-mono border border-line">
                  <div className="flex justify-between">
                    <span className="text-muted">Overround (Margem):</span>
                    <span className="text-gold font-bold">{pct(devigResult.overround - 1)}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-line/60">
                    <span className="text-primary">P(Casa): {pct(devigResult.pHome)}</span>
                    <span className="text-muted">P(Empate): {pct(devigResult.pDraw)}</span>
                    <span className="text-gold">P(Fora): {pct(devigResult.pAway)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Backtest Results */}
            {backtestResult && (
              <div className="space-y-4">
                {/* Metric Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-xl border border-line bg-surface p-3 text-center">
                    <p className="text-[10px] text-muted uppercase">Lucro Líquido (PnL)</p>
                    <p
                      className={`font-mono text-xl font-bold ${
                        backtestResult.netProfit >= 0 ? "text-primary" : "text-live"
                      }`}
                    >
                      {backtestResult.netProfit >= 0 ? "+" : ""}€{backtestResult.netProfit.toFixed(2)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-line bg-surface p-3 text-center">
                    <p className="text-[10px] text-muted uppercase">ROI (%)</p>
                    <p
                      className={`font-mono text-xl font-bold ${
                        backtestResult.roi >= 0 ? "text-primary" : "text-live"
                      }`}
                    >
                      {pct(backtestResult.roi)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-line bg-surface p-3 text-center">
                    <p className="text-[10px] text-muted uppercase">Taxa de Acerto (WinRate)</p>
                    <p className="font-mono text-xl font-bold text-fg">
                      {pct(backtestResult.winRate)} ({backtestResult.wonBets}/{backtestResult.totalBets})
                    </p>
                  </div>
                  <div className="rounded-xl border border-line bg-surface p-3 text-center">
                    <p className="text-[10px] text-muted uppercase">Brier Score / Drawdown</p>
                    <p className="font-mono text-xl font-bold text-gold">
                      {backtestResult.brierScore.toFixed(3)} · {backtestResult.maxDrawdownPct}%
                    </p>
                  </div>
                </div>

                {/* Bet ledger */}
                <div className="rounded-2xl border border-line bg-surface p-4">
                  <h4 className="text-xs font-semibold text-fg uppercase tracking-wider mb-3">
                    Histórico de Apostas Executadas:
                  </h4>
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {backtestResult.records.map((rec) => (
                      <div
                        key={rec.id}
                        className="flex items-center justify-between rounded-lg border border-line bg-bg p-2.5 text-xs"
                      >
                        <div>
                          <p className="font-semibold text-fg">
                            {rec.match} ·{" "}
                            <span className="text-gold font-mono">
                              {rec.betOn} @ {rec.odds.toFixed(2)}
                            </span>
                          </p>
                          <p className="text-[10px] text-muted font-mono">
                            Stake: €{rec.stake.toFixed(2)} | Model: {pct(rec.modelProb)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p
                            className={`font-mono font-bold ${
                              rec.outcome === "won" ? "text-primary" : "text-live"
                            }`}
                          >
                            {rec.outcome === "won" ? `+€${rec.pnl.toFixed(2)}` : `-€${rec.stake.toFixed(2)}`}
                          </p>
                          <p className="text-[10px] text-muted font-mono">
                            Banca: €{rec.bankrollAfter.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW: TABLES */}
      {view === "table" && (
        <div className="mt-5 space-y-3">
          {/* Category Filter */}
          <div className="flex flex-wrap gap-1.5 p-1 bg-surface rounded-lg border border-line text-xs font-semibold">
            {[
              ["all", lang === "pt" ? "Todas as Competições" : "All Competitions"],
              ["UEFA", "UEFA (Champions / Europa / Conference)"],
              ["América do Sul", lang === "pt" ? "América do Sul (Libertadores / Brasil / Argentina)" : "South America"],
              ["Ligas", lang === "pt" ? "Ligas Nacionais Europeias" : "European Domestic Leagues"],
            ].map(([reg, label]) => (
              <button
                key={reg}
                type="button"
                onClick={() => setTableRegion(reg)}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  tableRegion === reg ? "bg-surface-2 text-fg shadow-xs border border-line" : "text-muted hover:text-fg"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {TABLE_LEAGUES
              .filter(([_, __, reg]) => tableRegion === "all" || reg === tableRegion)
              .map(([id, name]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTableLeague(id)}
                  className={`shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    tableLeague === id
                      ? "bg-primary text-primary-ink"
                      : "bg-surface border border-line text-muted hover:text-fg"
                  }`}
                >
                  {name}
                </button>
            ))}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead className="text-[11px] font-semibold tracking-wider text-muted uppercase bg-surface-2">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">{lang === "pt" ? "Clube" : "Club"}</th>
                  <th className="px-3 py-3 text-right">{lang === "pt" ? "Jogos" : "P"}</th>
                  <th className="px-3 py-3 text-right">{lang === "pt" ? "DG" : "GD"}</th>
                  <th className="px-4 py-3 text-right font-bold text-fg">Pts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(table?.rows ?? []).map((row) => (
                  <tr key={row.abbr + row.rank} className="hover:bg-surface-2/60 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-muted">
                      {row.rank}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-fg">
                      {row.team}
                      {row.note && (
                        <span className="ml-2 text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                          {row.note}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-muted">
                      {row.played}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-muted">
                      {row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}
                    </td>
                    <td className="px-4 py-2.5 text-right font-display text-base font-bold tabular-nums text-fg">
                      {row.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!table?.rows.length && (
              <p className="px-4 py-12 text-center text-sm text-muted">
                {lang === "pt" ? "A carregar classificação..." : "Loading league table..."}
              </p>
            )}
          </div>
        </div>
      )}

      {/* VIEW: VALUE SCANNER */}
      {view === "value" && (
        <div className="mt-5 space-y-4">
          <div className="rounded-xl border border-line bg-surface p-4">
            <h3 className="font-display text-lg font-bold text-fg flex items-center gap-2">
              <Sparkles size={18} className="text-gold" />
              <span>
                {lang === "pt"
                  ? "Oportunidades de Valor Matemático (+EV)"
                  : "Expected Value (+EV) Opportunities"}
              </span>
            </h3>
            <p className="mt-1 text-xs text-muted max-w-2xl leading-relaxed">
              {lang === "pt"
                ? "Identifica desajustes onde o modelo Dixon-Coles atribui maior probabilidade do que a odd do mercado. As apostas sugeridas aplicam o Critério Quarter-Kelly sobre a banca configurada, minimizando risco."
                : "Identifies edges where the Dixon-Coles model assigns higher win probabilities than bookmaker odds. Suggested stakes use Quarter-Kelly criterion for risk-adjusted growth."}
            </p>
          </div>

          {picks.length === 0 ? (
            <div className="rounded-2xl border border-line bg-surface p-12 text-center text-sm text-muted">
              {lang === "pt"
                ? "Nenhuma oportunidade de valor identificada para esta jornada (Edge > 2%)."
                : "No high-edge value picks found for this slate (Edge > 2%)."}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {picks.map((row) => (
                <div
                  key={row.id}
                  className="rounded-xl border border-line bg-surface p-4 hover:border-gold/50 transition-colors flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs text-muted uppercase">
                      <span>{row.league}</span>
                      <span className="font-mono text-gold font-semibold">
                        +EV {pct(row.edge)}
                      </span>
                    </div>
                    <p className="font-display mt-2 text-base font-bold text-fg">{row.match}</p>
                    <div className="mt-3 flex items-center justify-between border-y border-line py-2">
                      <span className="text-xs text-muted">
                        {lang === "pt" ? "Mercado:" : "Market:"}{" "}
                        <strong className="text-fg">{row.market}</strong>
                      </span>
                      <span className="font-mono text-sm font-bold text-primary">
                        @ {row.decimal.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs">
                    <div>
                      <p className="text-[11px] text-muted">
                        {lang === "pt" ? "Prob. Modelo" : "Model Prob"}
                      </p>
                      <p className="font-mono font-semibold text-fg">{pct(row.model)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-muted">
                        {lang === "pt" ? "Aposta Sugerida" : "Suggested Stake"}
                      </p>
                      <p className="font-mono font-bold text-gold">€{row.stake.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW: SIMULATOR */}
      {view === "simulator" && (
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(320px,1fr)_minmax(0,1.8fr)]">
          {/* Controls */}
          <div className="rounded-2xl border border-line bg-surface p-5 space-y-4">
            <div>
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                {lang === "pt" ? "Configuração do Jogo" : "Fixture Setup"}
              </span>
              <h3 className="font-display text-xl font-bold text-fg">
                {lang === "pt" ? "Parâmetros do Modelo" : "Model Parameters"}
              </h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted block mb-1">
                  {lang === "pt" ? "Equipa da Casa" : "Home Team"}
                </label>
                <input
                  type="text"
                  value={simHomeTeam}
                  onChange={(e) => setSimHomeTeam(e.target.value)}
                  className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-fg focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-muted block mb-1">
                  {lang === "pt" ? "Equipa Visitante" : "Away Team"}
                </label>
                <input
                  type="text"
                  value={simAwayTeam}
                  onChange={(e) => setSimAwayTeam(e.target.value)}
                  className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-fg focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted">
                    {lang === "pt" ? "xG Esperado Casa:" : "Home xG:"}
                  </span>
                  <span className="font-mono text-primary font-bold">{simHomeXg.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="4.0"
                  step="0.05"
                  value={simHomeXg}
                  onChange={(e) => setSimHomeXg(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted">
                    {lang === "pt" ? "xG Esperado Fora:" : "Away xG:"}
                  </span>
                  <span className="font-mono text-gold font-bold">{simAwayXg.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="4.0"
                  step="0.05"
                  value={simAwayXg}
                  onChange={(e) => setSimAwayXg(Number(e.target.value))}
                  className="w-full accent-gold"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleRunSimulation}
              className="w-full rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-ink hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <Calculator size={15} />
              <span>
                {lang === "pt"
                  ? "Executar Simulação (10.000 Jogos)"
                  : "Run Simulation (10,000 matches)"}
              </span>
            </button>

            <div className="pt-2 border-t border-line text-[11px] text-muted space-y-1">
              <p>
                {lang === "pt"
                  ? "O motor avalia distribuições bivariadas de Poisson de acordo com a formulação Dixon-Coles, ajustando as correlações de resultados baixos (0-0, 1-0, 0-1, 1-1)."
                  : "The engine runs bivariate Poisson distributions with Dixon-Coles low-score tau adjustments."}
              </p>
            </div>
          </div>

          {/* Results Display */}
          {simResults && (
            <div className="space-y-4">
              {/* Match Header Summary */}
              <div className="rounded-2xl border border-line bg-surface p-5">
                <div className="flex items-center justify-between text-xs text-muted pb-3 border-b border-line">
                  <span>
                    {simResults.simulations.toLocaleString()}{" "}
                    {lang === "pt" ? "iterações Monte Carlo" : "Monte Carlo iterations"}
                  </span>
                  <span className="font-mono text-primary font-semibold">Dixon-Coles Modeled</span>
                </div>

                <div className="py-4 text-center">
                  <h3 className="font-display text-2xl font-bold text-fg sm:text-3xl">
                    {simHomeTeam} <span className="text-muted text-lg">vs</span> {simAwayTeam}
                  </h3>
                  <div className="mt-3 flex items-center justify-center gap-4 text-sm font-mono text-muted">
                    <span>
                      xG {simHomeTeam}:{" "}
                      <strong className="text-fg">{simResults.avgHomeGoals.toFixed(2)}</strong>
                    </span>
                    <span>·</span>
                    <span>
                      xG {simAwayTeam}:{" "}
                      <strong className="text-fg">{simResults.avgAwayGoals.toFixed(2)}</strong>
                    </span>
                  </div>
                </div>

                {/* 1X2 Probabilities Bar */}
                <div className="space-y-2 mt-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-primary">
                      {simHomeTeam} ({pct(simResults.homeWinPct)})
                    </span>
                    <span className="text-muted">
                      {lang === "pt" ? "Empate" : "Draw"} ({pct(simResults.drawPct)})
                    </span>
                    <span className="text-gold">
                      {simAwayTeam} ({pct(simResults.awayWinPct)})
                    </span>
                  </div>
                  <div className="h-3 w-full rounded-full overflow-hidden bg-bg flex">
                    <div
                      className="bg-primary h-full transition-all duration-300"
                      style={{ width: `${simResults.homeWinPct * 100}%` }}
                    />
                    <div
                      className="bg-muted h-full transition-all duration-300"
                      style={{ width: `${simResults.drawPct * 100}%` }}
                    />
                    <div
                      className="bg-gold h-full transition-all duration-300"
                      style={{ width: `${simResults.awayWinPct * 100}%` }}
                    />
                  </div>
                </div>

                {/* Fair Odds */}
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-bg p-2.5">
                    <p className="text-[10px] text-muted uppercase">
                      {lang === "pt" ? "Odd Justa Casa" : "Fair Home"}
                    </p>
                    <p className="font-mono text-base font-bold text-primary">
                      {(1 / simResults.homeWinPct).toFixed(2)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-bg p-2.5">
                    <p className="text-[10px] text-muted uppercase">
                      {lang === "pt" ? "Odd Justa Empate" : "Fair Draw"}
                    </p>
                    <p className="font-mono text-base font-bold text-fg">
                      {(1 / simResults.drawPct).toFixed(2)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-bg p-2.5">
                    <p className="text-[10px] text-muted uppercase">
                      {lang === "pt" ? "Odd Justa Fora" : "Fair Away"}
                    </p>
                    <p className="font-mono text-base font-bold text-gold">
                      {(1 / simResults.awayWinPct).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Goal Markets & Probabilities */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-line bg-surface p-4">
                  <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
                    {lang === "pt" ? "Mercados de Golos" : "Goal Line Probabilities"}
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-fg">Over 1.5</span>
                        <span className="font-mono text-muted">{pct(simResults.over15Pct)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-bg overflow-hidden">
                        <div
                          className="bg-primary h-full"
                          style={{ width: `${simResults.over15Pct * 100}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-fg">Over 2.5</span>
                        <span className="font-mono text-muted">{pct(simResults.over25Pct)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-bg overflow-hidden">
                        <div
                          className="bg-primary h-full"
                          style={{ width: `${simResults.over25Pct * 100}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-fg">Over 3.5</span>
                        <span className="font-mono text-muted">{pct(simResults.over35Pct)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-bg overflow-hidden">
                        <div
                          className="bg-primary h-full"
                          style={{ width: `${simResults.over35Pct * 100}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-fg">
                          {lang === "pt" ? "Ambas Marcam (BTTS)" : "Both Teams To Score (BTTS)"}
                        </span>
                        <span className="font-mono text-gold">{pct(simResults.bttsPct)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-bg overflow-hidden">
                        <div
                          className="bg-gold h-full"
                          style={{ width: `${simResults.bttsPct * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-line bg-surface p-4">
                  <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
                    {lang === "pt" ? "Resultados Mais Prováveis" : "Most Likely Scorelines"}
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {simResults.mostFrequentScores.slice(0, 6).map((item, idx) => (
                      <div
                        key={item.score}
                        className={`rounded-xl p-2.5 text-center border ${
                          idx === 0
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-line bg-bg text-fg"
                        }`}
                      >
                        <p className="font-mono text-base font-bold">{item.score}</p>
                        <p className="text-[11px] text-muted">{pct(item.pct)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW: MATCHES */}
      {view === "matches" && (
        <section className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.85fr)]">
          {/* Matches List */}
          <div className="space-y-2">
            {shown.length === 0 && (
              <div className="rounded-2xl border border-line bg-surface p-12 text-center text-sm text-muted">
                {lang === "pt"
                  ? "Nenhum jogo encontrado com os filtros atuais."
                  : "No fixtures match current filters. Try another day or league."}
              </div>
            )}
            {shown.map((m) => {
              const flow = sportFlow(m);
              const isSelected = pick?.id === m.id;
              const hasValue = picks.some((p) => p.match.includes(m.home) || p.match.includes(m.away));
              const alphaSignal = computeAlphaPySignals(m);

              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelected(m.id)}
                  className={`grid w-full grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-colors ${
                    isSelected
                      ? "border-primary bg-surface-2 shadow-xs"
                      : "border-line bg-surface hover:border-line/80"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-muted uppercase">
                      <span>{m.league}</span>
                      {m.phase === "in" && (
                        <span className="inline-flex items-center gap-1 text-live font-semibold">
                          <Radio size={10} className="animate-pulse" />
                          <span>LIVE</span>
                        </span>
                      )}
                      {hasValue && (
                        <span className="text-gold font-semibold text-[10px] bg-gold/15 px-1.5 py-0.2 rounded">
                          +EV
                        </span>
                      )}
                      {alphaSignal.primarySignal === "UPSET_ALERT" && (
                        <span className="text-live font-semibold text-[10px] bg-live/15 px-1.5 py-0.2 rounded flex items-center gap-1">
                          <ShieldAlert size={10} />
                          <span>UPSET</span>
                        </span>
                      )}
                    </div>
                    <p className="truncate font-display text-lg font-bold text-fg mt-0.5">
                      {m.home} <span className="text-muted font-normal text-sm">vs</span> {m.away}
                    </p>
                    <p className="text-xs text-muted">
                      {m.detail || kickLabel(m.kickoff, lang)}
                    </p>
                  </div>

                  <div className="text-right">
                    {m.phase === "pre" ? (
                      <p className="font-display text-sm font-semibold text-gold font-mono">
                        {pct(m.model.home)} · {pct(m.model.draw)} · {pct(m.model.away)}
                      </p>
                    ) : (
                      <p className="font-display text-2xl font-bold tabular-nums text-fg">
                        {m.homeScore ?? 0}
                        <span className="mx-1 text-muted">–</span>
                        {m.awayScore ?? 0}
                      </p>
                    )}
                    <p className="text-xs text-muted mt-0.5 font-mono">
                      AlphaPy <span className="text-primary font-semibold">{flow}</span>
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Match Detail Sidebar */}
          <aside className="lg:sticky lg:top-4 lg:self-start">
            {pick ? (
              <Detail
                match={pick}
                lang={lang}
                onOpenSimulator={() => handleLoadMatchIntoSimulator(pick)}
              />
            ) : null}
            <p className="mt-3 text-[11px] leading-relaxed text-muted">{board.source}</p>
          </aside>
        </section>
      )}
    </main>
  );
}

function Bar({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "home" | "draw" | "away";
}) {
  const color = tone === "home" ? "bg-primary" : tone === "away" ? "bg-gold" : "bg-muted";
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-muted">
        <span>{label}</span>
        <span className="tabular-nums font-mono text-fg font-semibold">{pct(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-bg">
        <div
          className={`h-full ${color} transition-all duration-300`}
          style={{ width: `${Math.max(2, value * 100)}%` }}
        />
      </div>
    </div>
  );
}

function Detail({
  match,
  lang,
  onOpenSimulator,
}: {
  match: MatchView;
  lang: "pt" | "en";
  onOpenSimulator: () => void;
}) {
  const matrix = useMemo(() => scoreMatrix(match.homeXg, match.awayXg, -0.1, 4), [
    match.homeXg,
    match.awayXg,
  ]);
  const topScores = useMemo(() => getTopScorelines(matrix, 4), [matrix]);
  const alphaSignal = useMemo(() => computeAlphaPySignals(match), [match]);

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 space-y-4">
      {/* Top Header */}
      <div>
        <div className="flex items-center justify-between text-xs text-muted uppercase">
          <span>{match.league}</span>
          <span className="font-mono text-primary font-semibold flex items-center gap-1">
            <Activity size={12} />
            <span>AlphaPy Flow {alphaSignal.sportFlow}/100</span>
          </span>
        </div>
        <h2 className="font-display mt-1 text-2xl font-bold text-fg">
          {match.home} <span className="text-muted text-base font-normal">vs</span> {match.away}
        </h2>
        <p className="text-xs text-muted">{kickLabel(match.kickoff, lang)}</p>
      </div>

      {/* AlphaPy Signals Strip */}
      <div className="rounded-xl bg-bg p-3 border border-line text-xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-muted font-medium">Sinal AlphaPy:</span>
          <span
            className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded ${
              alphaSignal.primarySignal === "STRONG_HOME"
                ? "bg-primary/20 text-primary"
                : alphaSignal.primarySignal === "UPSET_ALERT"
                  ? "bg-live/20 text-live"
                  : alphaSignal.primarySignal === "VALUE_DRAW"
                    ? "bg-gold/20 text-gold"
                    : "bg-surface-2 text-muted"
            }`}
          >
            {alphaSignal.primarySignal.replace("_", " ")}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1 border-t border-line/60">
          <div>
            <span className="text-muted block">Disagreement Edge:</span>
            <span className="text-primary font-bold">
              {alphaSignal.disagreementAlpha > 0 ? "+" : ""}
              {alphaSignal.disagreementAlpha}%
            </span>
          </div>
          <div>
            <span className="text-muted block">Alerta de Upset:</span>
            <span
              className={`font-bold ${
                alphaSignal.upsetPotential >= 50 ? "text-live" : "text-fg"
              }`}
            >
              {alphaSignal.upsetPotential}%
            </span>
          </div>
        </div>
      </div>

      {/* Primary KPI Strip */}
      <dl className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-bg px-2 py-3">
          <dt className="text-[11px] text-muted">{lang === "pt" ? "xG Casa" : "Home xG"}</dt>
          <dd className="font-display text-xl font-bold font-mono text-fg">
            {match.homeXg.toFixed(2)}
          </dd>
        </div>
        <div className="rounded-xl bg-bg px-2 py-3 border border-primary/20">
          <dt className="text-[11px] text-muted">
            {lang === "pt" ? "Resultado Provável" : "Predicted"}
          </dt>
          <dd className="font-display text-xl font-bold font-mono text-primary">
            {match.scoreline}
          </dd>
        </div>
        <div className="rounded-xl bg-bg px-2 py-3">
          <dt className="text-[11px] text-muted">{lang === "pt" ? "xG Fora" : "Away xG"}</dt>
          <dd className="font-display text-xl font-bold font-mono text-fg">
            {match.awayXg.toFixed(2)}
          </dd>
        </div>
      </dl>

      {/* 1X2 Probabilities */}
      <div className="space-y-2.5">
        <Bar
          label={`${match.home} (${lang === "pt" ? "Vitória" : "Win"})`}
          value={match.model.home}
          tone="home"
        />
        <Bar label={lang === "pt" ? "Empate" : "Draw"} value={match.model.draw} tone="draw" />
        <Bar
          label={`${match.away} (${lang === "pt" ? "Vitória" : "Win"})`}
          value={match.model.away}
          tone="away"
        />
      </div>

      {/* Over / BTTS Stats */}
      <div className="flex justify-between text-xs text-muted border-t border-line pt-3 font-mono">
        <span>
          Over 2.5: <strong className="text-fg">{pct(match.model.over25)}</strong>
        </span>
        <span>
          BTTS: <strong className="text-fg">{pct(match.model.btts)}</strong>
        </span>
      </div>

      {/* Exact Scoreline Probability Heatmap */}
      <div className="border-t border-line pt-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-fg">
            {lang === "pt" ? "Matriz de Resultados Prováveis" : "Score Probability Heatmap"}
          </span>
          <span className="text-[10px] text-muted font-mono">Dixon-Coles</span>
        </div>

        {/* 4x4 Heatmap Table */}
        <div className="overflow-x-auto rounded-lg bg-bg p-2 border border-line">
          <table className="w-full text-center text-[10px] font-mono">
            <thead>
              <tr className="text-muted text-[9px]">
                <th className="p-1">H \ A</th>
                <th className="p-1">0</th>
                <th className="p-1">1</th>
                <th className="p-1">2</th>
                <th className="p-1">3</th>
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2, 3].map((h) => (
                <tr key={h}>
                  <td className="p-1 font-bold text-muted">{h}</td>
                  {[0, 1, 2, 3].map((a) => {
                    const prob = matrix[h]?.[a] ?? 0;
                    const intensity = Math.min(1, prob * 6);
                    return (
                      <td
                        key={a}
                        className="p-1 rounded text-[10px] tabular-nums font-semibold"
                        style={{
                          backgroundColor: `rgba(61, 204, 110, ${intensity * 0.4})`,
                          color: intensity > 0.4 ? "#3dcc6e" : "#8fa396",
                        }}
                      >
                        {pct(prob)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Quick Top Scores */}
        <div className="grid grid-cols-4 gap-1.5 pt-1">
          {topScores.map((ts) => (
            <div key={ts.score} className="rounded-lg bg-bg p-1.5 text-center border border-line">
              <p className="font-mono text-xs font-bold text-fg">{ts.score}</p>
              <p className="font-mono text-[10px] text-primary">{pct(ts.prob)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Odds & Market Comparison */}
      {match.odds && (
        <div className="border-t border-line pt-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">
              {lang === "pt" ? "Odds Mercado (" : "Market Odds ("}
              {match.book ?? "Book"}):
            </span>
            <span className="font-mono text-xs font-semibold text-fg">
              1: {match.odds.home.toFixed(2)} | X: {match.odds.draw.toFixed(2)} | 2:{" "}
              {match.odds.away.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Form Guides */}
      {(match.formHome || match.formAway) && (
        <div className="border-t border-line pt-2 text-xs text-muted flex justify-between font-mono">
          <span>{lang === "pt" ? "Forma:" : "Form:"}</span>
          <span className="tracking-widest uppercase text-fg">
            {match.homeAbbr} ({match.formHome || "—"}) · {match.awayAbbr} ({match.formAway || "—"})
          </span>
        </div>
      )}

      {/* Action button to open Simulator */}
      <button
        type="button"
        onClick={onOpenSimulator}
        className="w-full mt-2 rounded-xl bg-surface-2 border border-line hover:border-primary/50 py-2 text-xs font-semibold text-fg transition-colors flex items-center justify-center gap-2"
      >
        <Calculator size={14} className="text-primary" />
        <span>
          {lang === "pt" ? "Simular este Jogo no Foot Lab" : "Simulate in Match Lab"}
        </span>
        <ChevronRight size={14} className="text-muted" />
      </button>
    </div>
  );
}
