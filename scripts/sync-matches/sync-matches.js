import axios from "axios";
import { load } from "cheerio";
import { randomUUID } from "crypto";
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import {
  LEAGUE_CONFIG,
  SEASON_ID,
  TEAM_CLUB_IDS,
  getGameNumber
} from "./sync-matches-config.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const BASE_URL = "http://www.futsal.or.kr/gameLeagueRecord.action";
const DATA_DIR = join(ROOT, "data/seasons", SEASON_ID, "division");
const MASTERS_PLAYERS_PATH = join(ROOT, "data/masters/players.json");
const REGS_PATH = join(
  ROOT,
  "data/seasons",
  SEASON_ID,
  "player_registrations.json"
);
const GOAL_COL_START = 7;

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function writeJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

function nextPlayerId(players) {
  const max = players.reduce((acc, p) => {
    const n = Number(String(p.id).replace(/^pl_/, ""));
    return Number.isFinite(n) && n > acc ? n : acc;
  }, 0);
  return `pl_${String(max + 1).padStart(4, "0")}`;
}

/**
 * matches.json에서 크롤 대상 목록 생성
 * @param {string} [division] - fk1, fk2, wk 중 하나. 생략 시 전체
 * @param {object} [opts] - matchIds, dateSet
 */
function buildCrawlList(division, opts = {}) {
  const { matchIds, dateSet } = opts;
  const divisions = division ? [division] : ["fk1", "fk2", "wk"];
  const games = [];
  const matchIdSet = matchIds?.length ? new Set(matchIds) : null;

  for (const div of divisions) {
    const config = LEAGUE_CONFIG[div];
    if (!config?.league_seq || !config?.league_type) continue;

    const matchesPath = join(DATA_DIR, div, "matches.json");
    let matches;
    try {
      matches = readJson(matchesPath);
    } catch {
      continue;
    }

    for (const m of matches) {
      const byMatchId = matchIdSet?.has(m.id);
      const byDate = dateSet?.has(m.date);
      const hasExplicit = matchIdSet || dateSet;
      if (hasExplicit) {
        if (!byMatchId && !byDate) continue;
      } else {
        const today = new Date().toISOString().slice(0, 10);
        const datePassed = m.date && m.date <= today;
        if (!datePassed || m.status !== "SCHEDULED") continue;
      }

      const club1 = TEAM_CLUB_IDS[m.homeTeamId];
      const club2 = TEAM_CLUB_IDS[m.awayTeamId];
      const gameNumber = getGameNumber(m.id);

      if (!club1 || !club2 || gameNumber == null) {
        console.warn(
          `skip ${m.id}: club/game_number 없음 (${m.homeTeamId}/${m.awayTeamId})`
        );
        continue;
      }

      const url = `${BASE_URL}?club1_id=${club1}&club2_id=${club2}&league_seq=${config.league_seq}&league_type=${config.league_type}&game_number=${gameNumber}`;
      games.push({
        url,
        homeTeamId: m.homeTeamId,
        awayTeamId: m.awayTeamId,
        matchId: m.id,
        matchDate: m.date,
        division: div
      });
    }
  }

  return games;
}

function parseMinute(val) {
  const raw = String(val).replace(/\(og.*/i, "").replace(/\).*/i, "").trim();
  const n = parseInt(raw, 10);
  if (isNaN(n)) return null;
  if (n <= 20) return { half: 1, minute: n };
  if (n <= 40) return { half: 2, minute: n - 20 };
  return { half: 2, minute: 20 };
}

function isOwnGoalText(val) {
  return /\(og/i.test(String(val));
}

function createPlayerResolver(players, regs) {
  const playerById = new Map(players.map((p) => [p.id, p]));
  const activeRegs = regs.filter((r) => r.endDate == null);

  const byTeamShirt = new Map();
  const byTeamName = new Map();

  for (const r of activeRegs) {
    const player = playerById.get(r.playerId);
    if (!player) continue;
    byTeamShirt.set(`${r.teamId}#${r.shirtNumber}`, r.playerId);
    byTeamName.set(`${r.teamId}#${player.name}`, r.playerId);
  }

  const ensurePlayer = (teamId, shirtNumber, name, matchDate) => {
    const shirtKey = `${teamId}#${shirtNumber}`;
    const nameKey = `${teamId}#${name}`;
    const existing =
      byTeamShirt.get(shirtKey) || byTeamName.get(nameKey) || null;
    if (existing) return { playerId: existing, created: false };

    const playerId = nextPlayerId(players);
    const player = { id: playerId, name };
    players.push(player);
    playerById.set(playerId, player);

    const reg = {
      id: `pr_${playerId}_${SEASON_ID}_${teamId.replace(/^t_/, "")}`,
      seasonId: SEASON_ID,
      playerId,
      teamId,
      shirtNumber: Number(shirtNumber) || null,
      startDate: matchDate,
      endDate: null
    };
    regs.push(reg);
    byTeamShirt.set(shirtKey, playerId);
    byTeamName.set(nameKey, playerId);

    return { playerId, created: true, player, reg };
  };

  return { ensurePlayer, players, regs };
}

function collectGoalValues(cells, $) {
  const values = [];
  for (let i = GOAL_COL_START; i < cells.length; i++) {
    const val = $(cells[i]).text().trim();
    if (val) values.push(val);
  }
  return values;
}

/**
 * @param {object} $ - cheerio instance
 * @param {object} table - cheerio table element
 * @param {string} teamId - 팀 id (해당 테이블 소속)
 * @param {string} [opponentTeamId] - 상대팀 id (자책골 시 득점 팀)
 */
function extractGoals($, table, teamId, opponentTeamId, resolvePlayer, matchDate) {
  const goals = [];
  const created = [];

  table.find("tr").each((_, row) => {
    const cells = $(row).find("td.record_text_bg2");
    if (cells.length < GOAL_COL_START + 1) return;

    const number = $(cells[0]).text().trim();
    const name = $(cells[1]).text().trim();
    if (!number || !name) return;

    const values = collectGoalValues(cells, $);
    if (!values.length) return;

    const resolved = resolvePlayer(teamId, number, name, matchDate);
    if (resolved.created) created.push(resolved);

    for (const val of values) {
      const parsed = parseMinute(val);
      if (!parsed) continue;

      const ownGoal = isOwnGoalText(val) && opponentTeamId;
      goals.push({
        id: randomUUID(),
        playerId: resolved.playerId,
        teamId: ownGoal ? opponentTeamId : teamId,
        half: parsed.half,
        minute: parsed.minute,
        isOwnGoal: !!ownGoal
      });
    }
  });

  return { goals, created };
}

function loadTeamNameHints() {
  const path = join(
    ROOT,
    "data/seasons",
    SEASON_ID,
    "team_seasons.json"
  );
  try {
    return readJson(path).map((t) => ({
      teamId: t.teamId,
      name: t.name
    }));
  } catch {
    return [];
  }
}

function resolveTeamIdByLabel(label, teams) {
  const raw = String(label).trim();
  const ranked = teams
    .map((t) => {
      if (t.name === raw) return { teamId: t.teamId, score: 100 };
      if (t.name.startsWith(raw)) return { teamId: t.teamId, score: 80 + raw.length };
      if (t.name.includes(raw)) return { teamId: t.teamId, score: 50 + raw.length };
      if (raw.includes(t.name)) return { teamId: t.teamId, score: 40 };
      return null;
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.teamId ?? null;
}

/** 비고란 자책골: "청주 6번 박성민 24분 - OG" */
function extractOwnGoalsFromNotes($, teams, homeTeamId, awayTeamId, resolvePlayer, matchDate) {
  const text = $("body")
    .text()
    .replace(/비고/g, " ")
    .replace(/\s+/g, " ");
  const re =
    /([가-힣A-Za-z0-9]+)\s+(\d+)번\s+([가-힣A-Za-z·]+)\s+(\d+)분\s*-\s*OG/g;
  const goals = [];
  const created = [];
  let match;
  while ((match = re.exec(text)) !== null) {
    const [, teamLabel, shirt, name, minuteRaw] = match;
    const scorerTeamId = resolveTeamIdByLabel(teamLabel, teams);
    if (!scorerTeamId) continue;
    const creditedTeamId =
      scorerTeamId === homeTeamId
        ? awayTeamId
        : scorerTeamId === awayTeamId
          ? homeTeamId
          : null;
    if (!creditedTeamId) continue;
    const parsed = parseMinute(minuteRaw);
    if (!parsed) continue;
    const resolved = resolvePlayer(
      scorerTeamId,
      shirt,
      name.trim(),
      matchDate
    );
    if (resolved.created) created.push(resolved);
    goals.push({
      id: randomUUID(),
      playerId: resolved.playerId,
      teamId: creditedTeamId,
      half: parsed.half,
      minute: parsed.minute,
      isOwnGoal: true
    });
  }
  return { goals, created };
}

async function crawlGameRecord(
  url,
  homeTeamId,
  awayTeamId,
  resolvePlayer,
  matchDate,
  teams
) {
  const { data } = await axios.get(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Referer: "http://www.futsal.or.kr"
    }
  });

  const $ = load(data);
  const scores = $(".record_20")
    .map((_, el) => Number($(el).text().trim()))
    .get();
  const score = { home: scores[0] || 0, away: scores[1] || 0 };

  const homeTable = $("table[width='499']").eq(0);
  const awayTable = $("table[width='499']").eq(1);
  const home = extractGoals(
    $,
    homeTable,
    homeTeamId,
    awayTeamId,
    resolvePlayer,
    matchDate
  );
  const away = extractGoals(
    $,
    awayTable,
    awayTeamId,
    homeTeamId,
    resolvePlayer,
    matchDate
  );
  const notes = extractOwnGoalsFromNotes(
    $,
    teams,
    homeTeamId,
    awayTeamId,
    resolvePlayer,
    matchDate
  );

  const goals = [...home.goals, ...away.goals, ...notes.goals];
  const goalTotal =
    goals.filter((g) => g.teamId === homeTeamId).length +
    goals.filter((g) => g.teamId === awayTeamId).length;
  if (goalTotal !== score.home + score.away) {
    console.warn(
      `score/goals 불일치: score ${score.home}-${score.away}, goals ${goalTotal}`
    );
  }

  return {
    score,
    goals,
    createdPlayers: [...home.created, ...away.created, ...notes.created]
  };
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const args = process.argv.slice(2);
  const dateIdx = args.indexOf("--date");
  const dateArg = dateIdx >= 0 ? args[dateIdx + 1] : null;
  const idsIdx = args.indexOf("--ids");
  const idsArg = idsIdx >= 0 ? args[idsIdx + 1] : null;
  const dateSet = dateArg
    ? new Set(dateArg.split(",").map((d) => d.trim()))
    : null;

  let matchIds = [];
  if (idsArg && idsArg.startsWith("[") && idsArg.endsWith("]")) {
    try {
      const parsed = JSON.parse(idsArg);
      matchIds = Array.isArray(parsed)
        ? parsed.filter((id) => typeof id === "string")
        : [];
    } catch {
      const inner = idsArg.slice(1, -1).trim();
      matchIds = inner
        ? inner
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.startsWith("m_"))
        : [];
    }
  }
  const writeBack = args.includes("--write");
  const filtered = args.filter(
    (a) =>
      a !== "--date" &&
      a !== dateArg &&
      a !== "--ids" &&
      a !== idsArg &&
      a !== "--write" &&
      !a.startsWith("--")
  );
  const division = filtered[0]?.match(/^fk[12]|wk$/) ? filtered[0] : null;
  if (!matchIds.length) {
    matchIds = filtered.filter((a) => a.startsWith("m_"));
  }
  const opts = {
    ...(matchIds.length && { matchIds }),
    ...(dateSet?.size && { dateSet })
  };
  const games = buildCrawlList(
    division || null,
    Object.keys(opts).length ? opts : undefined
  );

  console.log(
    `시즌 ${SEASON_ID} | 크롤 대상: ${games.length}경기 (${division || "전체"})${writeBack ? " [--write]" : ""}\n`
  );

  const players = readJson(MASTERS_PLAYERS_PATH);
  const regs = readJson(REGS_PATH);
  const teams = loadTeamNameHints();
  const { ensurePlayer } = createPlayerResolver(players, regs);

  const updatesByDiv = {};
  let createdCount = 0;

  for (const game of games) {
    console.log(
      `--- ${game.matchId} (${game.homeTeamId} vs ${game.awayTeamId}) ---`
    );
    try {
      const result = await crawlGameRecord(
        game.url,
        game.homeTeamId,
        game.awayTeamId,
        ensurePlayer,
        game.matchDate,
        teams
      );
      createdCount += result.createdPlayers.length;
      if (result.createdPlayers.length) {
        console.log(
          `신규 선수 ${result.createdPlayers.length}명:`,
          result.createdPlayers.map((c) => c.playerId).join(", ")
        );
      }
      console.log(
        JSON.stringify(
          {
            matchId: game.matchId,
            score: result.score,
            goals: result.goals.length
          },
          null,
          2
        )
      );
      // 기록지 미업로드(0-0·골 없음)는 반영하지 않음 → 다음 월요일 재시도
      const isEmptyRecord =
        result.score.home === 0 &&
        result.score.away === 0 &&
        result.goals.length === 0;
      if (isEmptyRecord) {
        console.warn("기록 없음(미업로드 가능) → skip");
        continue;
      }
      if (writeBack) {
        const div = game.division;
        if (!updatesByDiv[div]) updatesByDiv[div] = [];
        updatesByDiv[div].push({
          matchId: game.matchId,
          score: result.score,
          goals: result.goals
        });
      }
    } catch (err) {
      console.error(`실패: ${err.message}`);
    }
    await delay(500);
  }

  if (writeBack && Object.keys(updatesByDiv).length > 0) {
    for (const [div, updates] of Object.entries(updatesByDiv)) {
      const matchesPath = join(DATA_DIR, div, "matches.json");
      const matches = readJson(matchesPath);
      const idToUpdate = new Map(updates.map((u) => [u.matchId, u]));
      for (const m of matches) {
        const u = idToUpdate.get(m.id);
        if (!u) continue;
        m.score = u.score;
        m.goals = u.goals;
        m.status = "FINISHED";
      }
      writeJson(matchesPath, matches);
      console.log(`\n✓ ${div}/matches.json 반영 (${updates.length}경기)`);
    }
    writeJson(MASTERS_PLAYERS_PATH, players);
    writeJson(REGS_PATH, regs);
    console.log(
      `✓ masters/players + registrations 반영 (신규 선수 ${createdCount}명)`
    );
  }
}

main().catch(console.error);
