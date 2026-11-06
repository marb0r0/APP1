export type Phase = "pre" | "in" | "post";

export type MatchView = {
  id: string;
  league: string;
  leagueId: string;
  name: string;
  home: string;
  away: string;
  homeAbbr: string;
  awayAbbr: string;
  kickoff: string;
  phase: Phase;
  detail: string;
  homeScore: number | null;
  awayScore: number | null;
  formHome: string;
  formAway: string;
  market: { home: number; draw: number; away: number } | null;
  model: { home: number; draw: number; away: number; over25: number; btts: number };
  scoreline: string;
  homeXg: number;
  awayXg: number;
  book: string | null;
  odds: { home: number; draw: number; away: number } | null;
};

export type Board = {
  generatedAt: string;
  matches: MatchView[];
  source: string;
};

const LEAGUES: { id: string; name: string }[] = [
  // Competições Europeias (UEFA)
  { id: "uefa.champions", name: "Champions League" },
  { id: "uefa.europa", name: "Europa League" },
  { id: "uefa.europa.conf", name: "Conference League" },

  // Competições Sul-Americanas (CONMEBOL & Nacionais)
  { id: "conmebol.libertadores", name: "Copa Libertadores" },
  { id: "conmebol.sudamericana", name: "Copa Sul-Americana" },
  { id: "bra.1", name: "Brasileirão Série A" },
  { id: "arg.1", name: "Campeonato Argentino" },

  // Principais Ligas Europeias
  { id: "por.1", name: "Liga Portugal" },
  { id: "esp.1", name: "La Liga" },
  { id: "eng.1", name: "Premier League" },
  { id: "ita.1", name: "Serie A" },
  { id: "ger.1", name: "Bundesliga" },
  { id: "fra.1", name: "Ligue 1" },
  { id: "ned.1", name: "Eredivisie" },
  { id: "eng.2", name: "Championship" },
];

function poisson(k: number, lam: number) {
  let p = Math.exp(-lam);
  for (let i = 1; i <= k; i++) p *= lam / i;
  return p;
}

export function scoreMatrix(homeXg: number, awayXg: number, rho = -0.1, max = 8) {
  const grid: number[][] = [];
  let total = 0;
  for (let h = 0; h <= max; h++) {
    const row: number[] = [];
    for (let a = 0; a <= max; a++) {
      let tau = 1;
      if (h === 0 && a === 0) tau = 1 - homeXg * awayXg * rho;
      else if (h === 0 && a === 1) tau = 1 + homeXg * rho;
      else if (h === 1 && a === 0) tau = 1 + awayXg * rho;
      else if (h === 1 && a === 1) tau = 1 - rho;
      const v = Math.max(0, poisson(h, homeXg) * poisson(a, awayXg) * tau);
      row.push(v);
      total += v;
    }
    grid.push(row);
  }
  return grid.map((row) => row.map((v) => (total > 0 ? v / total : 0)));
}

export function summarize(matrix: number[][]) {
  let home = 0;
  let draw = 0;
  let away = 0;
  let over = 0;
  let btts = 0;
  let best = 0;
  let score = "1-1";
  const n = matrix.length;
  for (let h = 0; h < n; h++) {
    for (let a = 0; a < n; a++) {
      const p = matrix[h][a];
      if (h > a) home += p;
      else if (h === a) draw += p;
      else away += p;
      if (h + a >= 3) over += p;
      if (h > 0 && a > 0) btts += p;
      if (p > best) {
        best = p;
        score = `${h}-${a}`;
      }
    }
  }
  return { home, draw, away, over25: over, btts, scoreline: score };
}

export type ScoreProb = { score: string; homeGoals: number; awayGoals: number; prob: number };

export function getTopScorelines(matrix: number[][], limit = 6): ScoreProb[] {
  const list: ScoreProb[] = [];
  const n = matrix.length;
  for (let h = 0; h < n; h++) {
    for (let a = 0; a < n; a++) {
      list.push({ score: `${h}-${a}`, homeGoals: h, awayGoals: a, prob: matrix[h][a] });
    }
  }
  return list.sort((a, b) => b.prob - a.prob).slice(0, limit);
}

export type SimulationStats = {
  simulations: number;
  homeWins: number;
  draws: number;
  awayWins: number;
  homeWinPct: number;
  drawPct: number;
  awayWinPct: number;
  avgHomeGoals: number;
  avgAwayGoals: number;
  over15Pct: number;
  over25Pct: number;
  over35Pct: number;
  bttsPct: number;
  cleanSheetHomePct: number;
  cleanSheetAwayPct: number;
  mostFrequentScores: Array<{ score: string; count: number; pct: number }>;
};

/** Monte Carlo simulation: simulates n matches by sampling from Poisson distribution */
export function simulateMatch(homeXg: number, awayXg: number, runs = 10000): SimulationStats {
  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;
  let totalHomeGoals = 0;
  let totalAwayGoals = 0;
  let over15 = 0;
  let over25 = 0;
  let over35 = 0;
  let btts = 0;
  let cleanHome = 0;
  let cleanAway = 0;
  const scoreCounts = new Map<string, number>();

  function samplePoisson(lam: number) {
    const l = Math.exp(-lam);
    let k = 0;
    let p = 1.0;
    do {
      k++;
      p *= Math.random();
    } while (p > l);
    return k - 1;
  }

  for (let i = 0; i < runs; i++) {
    const h = samplePoisson(homeXg);
    const a = samplePoisson(awayXg);

    totalHomeGoals += h;
    totalAwayGoals += a;

    if (h > a) homeWins++;
    else if (h === a) draws++;
    else awayWins++;

    const total = h + a;
    if (total >= 2) over15++;
    if (total >= 3) over25++;
    if (total >= 4) over35++;
    if (h > 0 && a > 0) btts++;
    if (a === 0) cleanHome++;
    if (h === 0) cleanAway++;

    const key = `${h}-${a}`;
    scoreCounts.set(key, (scoreCounts.get(key) ?? 0) + 1);
  }

  const sortedScores = Array.from(scoreCounts.entries())
    .map(([score, count]) => ({ score, count, pct: count / runs }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    simulations: runs,
    homeWins,
    draws,
    awayWins,
    homeWinPct: homeWins / runs,
    drawPct: draws / runs,
    awayWinPct: awayWins / runs,
    avgHomeGoals: totalHomeGoals / runs,
    avgAwayGoals: totalAwayGoals / runs,
    over15Pct: over15 / runs,
    over25Pct: over25 / runs,
    over35Pct: over35 / runs,
    bttsPct: btts / runs,
    cleanSheetHomePct: cleanHome / runs,
    cleanSheetAwayPct: cleanAway / runs,
    mostFrequentScores: sortedScores,
  };
}

function americanToDecimal(ml: number) {
  if (ml > 0) return 1 + ml / 100;
  return 1 + 100 / Math.abs(ml);
}

function americanToProb(ml: number) {
  if (!Number.isFinite(ml) || ml === 0) return 0;
  if (ml > 0) return 100 / (ml + 100);
  return -ml / (-ml + 100);
}

function closeOdds(side: { close?: { odds?: string }; open?: { odds?: string } } | undefined) {
  const raw = side?.close?.odds ?? side?.open?.odds;
  if (!raw) return null;
  const n = Number(String(raw).replace("+", ""));
  return Number.isFinite(n) ? n : null;
}

function formPoints(form: string) {
  let pts = 0;
  let n = 0;
  for (const ch of form.toUpperCase()) {
    if (ch === "W") pts += 3;
    else if (ch === "D") pts += 1;
    else if (ch === "L") pts += 0;
    else continue;
    n += 1;
  }
  if (!n) return null;
  return pts / n;
}

function modelFromInputs(opts: {
  market: { home: number; draw: number; away: number } | null;
  formHome: string;
  formAway: string;
  totalLine: number | null;
}) {
  const fh = formPoints(opts.formHome);
  const fa = formPoints(opts.formAway);
  let homeShare = 0.55;
  if (opts.market) {
    const edge = opts.market.home + opts.market.away;
    homeShare = edge > 0 ? opts.market.home / edge : 0.5;
  } else if (fh != null && fa != null) {
    homeShare = (fh + 0.35) / (fh + fa + 0.7);
  }
  homeShare = Math.min(0.82, Math.max(0.18, homeShare));
  const total = opts.totalLine && opts.totalLine > 0.5 ? opts.totalLine : 2.55;
  const homeXg = Math.max(0.35, +(total * homeShare).toFixed(2));
  const awayXg = Math.max(0.35, +(total * (1 - homeShare)).toFixed(2));
  const sum = summarize(scoreMatrix(homeXg, awayXg));
  let blended = { home: sum.home, draw: sum.draw, away: sum.away };
  if (opts.market) {
    blended = {
      home: 0.45 * sum.home + 0.55 * opts.market.home,
      draw: 0.45 * sum.draw + 0.55 * opts.market.draw,
      away: 0.45 * sum.away + 0.55 * opts.market.away,
    };
    const t = blended.home + blended.draw + blended.away;
    blended = { home: blended.home / t, draw: blended.draw / t, away: blended.away / t };
  }
  return { ...sum, ...blended, homeXg, awayXg };
}

type EspnEvent = {
  id?: string;
  date?: string;
  name?: string;
  shortName?: string;
  competitions?: Array<{
    competitors?: Array<{
      homeAway?: string;
      score?: string;
      form?: string;
      team?: { displayName?: string; abbreviation?: string };
    }>;
    odds?: Array<{
      overUnder?: number;
      provider?: { name?: string };
      moneyline?: {
        home?: { close?: { odds?: string }; open?: { odds?: string } };
        away?: { close?: { odds?: string }; open?: { odds?: string } };
        draw?: { close?: { odds?: string }; open?: { odds?: string } };
      };
    }>;
    status?: { type?: { state?: string; shortDetail?: string; detail?: string } };
  }>;
  status?: { type?: { state?: string; shortDetail?: string; detail?: string } };
};

function mapEvent(ev: EspnEvent, league: { id: string; name: string }): MatchView | null {
  const comp = ev.competitions?.[0];
  if (!comp) return null;
  const sides = comp.competitors ?? [];
  const home = sides.find((s) => s.homeAway === "home") ?? sides[0];
  const away = sides.find((s) => s.homeAway === "away") ?? sides[1];
  if (!home || !away) return null;
  const status = ev.status?.type ?? comp.status?.type;
  const state = status?.state;
  const phase: Phase = state === "in" ? "in" : state === "post" ? "post" : "pre";
  const hs = home.score != null && home.score !== "" ? Number(home.score) : null;
  const as = away.score != null && away.score !== "" ? Number(away.score) : null;
  const ml = comp.odds?.[0];
  const hMl = closeOdds(ml?.moneyline?.home);
  const dMl = closeOdds(ml?.moneyline?.draw);
  const aMl = closeOdds(ml?.moneyline?.away);
  let market: MatchView["market"] = null;
  if (hMl != null && dMl != null && aMl != null) {
    const ph = americanToProb(hMl);
    const pd = americanToProb(dMl);
    const pa = americanToProb(aMl);
    const t = ph + pd + pa;
    if (t > 0) market = { home: ph / t, draw: pd / t, away: pa / t };
  }
  const modeled = modelFromInputs({
    market,
    formHome: home.form ?? "",
    formAway: away.form ?? "",
    totalLine: typeof ml?.overUnder === "number" ? ml.overUnder : null,
  });
  return {
    id: String(ev.id ?? `${league.id}-${home.team?.abbreviation}-${away.team?.abbreviation}`),
    league: league.name,
    leagueId: league.id,
    name: ev.name ?? "",
    home: home.team?.displayName ?? "Home",
    away: away.team?.displayName ?? "Away",
    homeAbbr: home.team?.abbreviation ?? "H",
    awayAbbr: away.team?.abbreviation ?? "A",
    kickoff: ev.date ?? "",
    phase,
    detail: status?.shortDetail || status?.detail || "",
    homeScore: Number.isFinite(hs) ? hs : null,
    awayScore: Number.isFinite(as) ? as : null,
    formHome: home.form ?? "",
    formAway: away.form ?? "",
    market,
    model: {
      home: modeled.home,
      draw: modeled.draw,
      away: modeled.away,
      over25: modeled.over25,
      btts: modeled.btts,
    },
    scoreline: modeled.scoreline,
    homeXg: modeled.homeXg,
    awayXg: modeled.awayXg,
    book: ml?.provider?.name ?? null,
    odds:
      hMl != null && dMl != null && aMl != null
        ? {
            home: americanToDecimal(hMl),
            draw: americanToDecimal(dMl),
            away: americanToDecimal(aMl),
          }
        : null,
  };
}

function yyyymmdd(offset: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

export async function loadBoard(offset: number): Promise<Board> {
  const date = yyyymmdd(offset);
  const batches = await Promise.all(
    LEAGUES.map(async (league) => {
      const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league.id}/scoreboard?dates=${date}`;
      try {
        const res = await fetch(url, { headers: { accept: "application/json" } });
        if (!res.ok) return [] as MatchView[];
        const json = (await res.json()) as { events?: EspnEvent[] };
        return (json.events ?? [])
          .map((ev) => mapEvent(ev, league))
          .filter((m): m is MatchView => Boolean(m));
      } catch {
        return [] as MatchView[];
      }
    }),
  );
  const matches = batches
    .flat()
    .sort((a, b) => {
      const rank = (p: Phase) => (p === "in" ? 0 : p === "pre" ? 1 : 2);
      const d = rank(a.phase) - rank(b.phase);
      if (d) return d;
      return a.kickoff.localeCompare(b.kickoff);
    });
  return {
    generatedAt: new Date().toISOString(),
    matches,
    source: "ESPN public scoreboard · Dixon-Coles + de-vigged moneylines",
  };
}

export type TableRow = {
  rank: number;
  team: string;
  abbr: string;
  played: number;
  goalDiff: number;
  points: number;
  note: string | null;
};

export type LeagueTable = {
  leagueId: string;
  league: string;
  rows: TableRow[];
};

function statValue(stats: Array<{ name?: string; value?: number }> | undefined, name: string) {
  const hit = stats?.find((s) => s.name === name);
  return typeof hit?.value === "number" ? hit.value : 0;
}

export async function loadTable(leagueId: string): Promise<LeagueTable> {
  const league = LEAGUES.find((l) => l.id === leagueId) ?? LEAGUES[0];
  const url = `https://site.api.espn.com/apis/v2/sports/soccer/${league.id}/standings`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) return { leagueId: league.id, league: league.name, rows: [] };
  const json = (await res.json()) as {
    children?: Array<{
      name?: string;
      standings?: {
        entries?: Array<{
          team?: { displayName?: string; abbreviation?: string };
          note?: { description?: string };
          stats?: Array<{ name?: string; value?: number }>;
        }>;
      };
    }>;
  };
  const children = json.children ?? [];
  const entries: Array<{
    team?: { displayName?: string; abbreviation?: string };
    note?: { description?: string };
    stats?: Array<{ name?: string; value?: number }>;
    groupName?: string;
  }> = [];

  for (const child of children) {
    const isGeneric = !child.name || ["overall", "2026", "2025", "2024", "futebol"].includes(child.name.toLowerCase());
    const groupName = isGeneric ? undefined : child.name;
    const childEntries = child.standings?.entries ?? [];
    for (const e of childEntries) {
      entries.push({
        ...e,
        groupName,
      });
    }
  }

  const rows = entries
    .map((entry) => ({
      rank: statValue(entry.stats, "rank"),
      team: entry.team?.displayName ?? "—",
      abbr: entry.team?.abbreviation ?? "",
      played: statValue(entry.stats, "gamesPlayed"),
      goalDiff: statValue(entry.stats, "pointDifferential"),
      points: statValue(entry.stats, "points"),
      note: entry.note?.description ?? entry.groupName ?? null,
    }))
    .sort((a, b) => {
      if (a.note && b.note && a.note !== b.note) return a.note.localeCompare(b.note);
      return a.rank - b.rank;
    });
  return { leagueId: league.id, league: league.name, rows };
}
