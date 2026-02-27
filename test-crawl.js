import axios from "axios";
import { load } from "cheerio";
import { readFileSync } from "fs";
import { join } from "path";
import {
  LEAGUE_CONFIG,
  TEAM_CLUB_IDS,
  getGameNumber
} from "./crawl-config.js";

const BASE_URL =
  "http://www.futsal.or.kr/gameLeagueRecord.action";
const DATA_DIR = "data/seasons/2025-2026/division";
const GOAL_COL_START = 7;

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
      matches = JSON.parse(readFileSync(matchesPath, "utf-8"));
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
        // 지정 없으면: 날짜 지났는데 스코어/골 둘 다 없는 경기만
        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const datePassed = m.date && m.date <= today;
        const hasScore = (m.score?.home ?? 0) + (m.score?.away ?? 0) > 0;
        const hasGoals = m.goals && m.goals.length > 0;
        if (!datePassed || hasScore || hasGoals) continue;
      }

      const club1 = TEAM_CLUB_IDS[m.homeTeamId];
      const club2 = TEAM_CLUB_IDS[m.awayTeamId];
      const gameNumber = getGameNumber(m.id);

      if (!club1 || !club2 || gameNumber == null) continue;

      const url = `${BASE_URL}?club1_id=${club1}&club2_id=${club2}&league_seq=${config.league_seq}&league_type=${config.league_type}&game_number=${gameNumber}`;
      games.push({
        url,
        homeTeamId: m.homeTeamId,
        awayTeamId: m.awayTeamId,
        matchId: m.id,
        division: div
      });
    }
  }

  return games;
}

function parseMinute(val) {
  const n = parseInt(val, 10);
  if (isNaN(n)) return null;
  if (n <= 20) return { half: 1, minute: n };
  if (n <= 40) return { half: 2, minute: n - 20 };
  return { half: 2, minute: 20 };
}

function extractGoals($, table, teamId) {
  const prefix = "p_" + teamId.replace("t_", "") + "_";
  const goals = [];
  table.find("tr").each((_, row) => {
    const cells = $(row).find("td.record_text_bg2");
    if (cells.length < GOAL_COL_START + 1) return;

    const number = $(cells[0]).text().trim();
    const name = $(cells[1]).text().trim();
    if (!number || !name) return;

    for (let i = GOAL_COL_START; i < cells.length; i++) {
      const val = $(cells[i]).text().trim();
      if (!val) continue;
      const parsed = parseMinute(val);
      if (parsed) {
        goals.push({
          playerId: prefix + number,
          teamId,
          half: parsed.half,
          minute: parsed.minute,
          isOwnGoal: false
        });
      }
    }
  });
  return goals;
}

async function crawlGameRecord(url, homeTeamId, awayTeamId) {
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
  const homeGoals = extractGoals($, homeTable, homeTeamId);
  const awayGoals = extractGoals($, awayTable, awayTeamId);

  return { score, goals: [...homeGoals, ...awayGoals] };
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
  // --ids "[m_fk2_33,m_fk2_34,m_fk2_35]" 또는 [m_w_14,m_w_15] 형식
  let matchIds = [];
  if (idsArg && idsArg.startsWith("[") && idsArg.endsWith("]")) {
    try {
      const parsed = JSON.parse(idsArg);
      matchIds = Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
    } catch {
      // 따옴표 없이 [m_28,m_29] 형식이면 쉼표로 분리
      const inner = idsArg.slice(1, -1).trim();
      matchIds = inner ? inner.split(",").map((s) => s.trim()).filter((s) => s.startsWith("m_")) : [];
    }
  }
  const filtered = args.filter(
    (a) =>
      a !== "--date" &&
      a !== dateArg &&
      a !== "--ids" &&
      a !== idsArg &&
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

  console.log(`크롤 대상: ${games.length}경기 (${division || "전체"})\n`);

  for (const game of games) {
    console.log(
      `--- ${game.matchId} (${game.homeTeamId} vs ${game.awayTeamId}) ---`
    );
    try {
      const result = await crawlGameRecord(
        game.url,
        game.homeTeamId,
        game.awayTeamId
      );
      console.log(
        JSON.stringify({ ...result, matchId: game.matchId }, null, 2)
      );
    } catch (err) {
      console.error(`실패: ${err.message}`);
    }
    await delay(500);
  }
}

main().catch(console.error);
