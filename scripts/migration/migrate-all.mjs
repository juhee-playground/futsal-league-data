#!/usr/bin/env node
/**
 * Futsal league data schema migration.
 * Usage:
 *   node scripts/migration/migrate-all.mjs --dry-run
 *   node scripts/migration/migrate-all.mjs
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const DATA = path.join(ROOT, "data");
const REPORTS = path.join(ROOT, "reports");

const dryRun = process.argv.includes("--dry-run");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (dryRun) {
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text);
}

function listSeasonDirs() {
  const seasonsRoot = path.join(DATA, "seasons");
  return fs
    .readdirSync(seasonsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function listDivisionDirs(seasonId) {
  const divisionRoot = path.join(DATA, "seasons", seasonId, "division");
  if (!fs.existsSync(divisionRoot)) {
    return [];
  }
  return fs
    .readdirSync(divisionRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function migratePlayers(report) {
  const filePath = path.join(DATA, "masters", "players.json");
  const players = readJson(filePath);
  let renamed = 0;
  let already = 0;

  const next = players.map((player) => {
    if (typeof player.id === "string" && player.id.length > 0) {
      already += 1;
      const { uuid: _uuid, ...rest } = player;
      return rest;
    }
    if (typeof player.uuid !== "string") {
      report.warnings.push(`player missing uuid/id: ${JSON.stringify(player)}`);
      return player;
    }
    renamed += 1;
    const { uuid, ...rest } = player;
    return { id: uuid, ...rest };
  });

  writeJson(filePath, next);
  report.players = { total: players.length, renamed, already };
}

function migrateRegistrations(report) {
  const legacyMap = [];
  const seasons = listSeasonDirs();

  report.registrations = {};

  for (const seasonId of seasons) {
    const filePath = path.join(
      DATA,
      "seasons",
      seasonId,
      "player_registrations.json"
    );
    if (!fs.existsSync(filePath)) {
      report.registrations[seasonId] = { skipped: true, reason: "file missing" };
      continue;
    }

    const rows = readJson(filePath);
    let converted = 0;
    let already = 0;

    const next = rows.map((row) => {
      const playerId =
        typeof row.playerId === "string" && row.playerId.startsWith("pl_")
          ? row.playerId
          : row.playerUuid;

      if (row.legacyPlayerId && playerId) {
        legacyMap.push({
          seasonId: row.seasonId ?? seasonId,
          legacyPlayerId: row.legacyPlayerId,
          playerId,
          teamId: row.teamId,
          shirtNumber: row.shirtNumber,
        });
      }

      const hasLegacyShape =
        Object.prototype.hasOwnProperty.call(row, "playerUuid") ||
        Object.prototype.hasOwnProperty.call(row, "legacyPlayerId") ||
        Object.prototype.hasOwnProperty.call(row, "divisionId");

      if (!hasLegacyShape && typeof row.playerId === "string") {
        already += 1;
        return row;
      }

      converted += 1;
      return {
        id: row.id,
        seasonId: row.seasonId ?? seasonId,
        playerId,
        teamId: row.teamId,
        shirtNumber: row.shirtNumber,
        startDate: row.startDate,
        endDate: row.endDate ?? null,
        ...(row.status ? { status: row.status } : {}),
      };
    });

    writeJson(filePath, next);
    report.registrations[seasonId] = {
      total: rows.length,
      converted,
      already,
    };
  }

  const mapPath = path.join(REPORTS, "legacy-player-id-map.json");
  // 재실행 시 이미 변환된 데이터만 있으면 기존 맵을 덮어쓰지 않음
  if (legacyMap.length > 0) {
    writeJson(mapPath, legacyMap);
  }
  report.legacyMapCount = legacyMap.length;
}

function migrateMatchGoals(report) {
  report.matches = {};
  let goalsTotal = 0;
  let goalsIdsAdded = 0;
  let goalsPlayerIdConverted = 0;
  let goalsAlready = 0;
  let uncertain = 0;

  for (const seasonId of listSeasonDirs()) {
    for (const divisionId of listDivisionDirs(seasonId)) {
      const filePath = path.join(
        DATA,
        "seasons",
        seasonId,
        "division",
        divisionId,
        "matches.json"
      );
      if (!fs.existsSync(filePath)) {
        continue;
      }

      const matches = readJson(filePath);
      const nextMatches = matches.map((match) => {
        const goals = Array.isArray(match.goals) ? match.goals : [];
        const nextGoals = goals.map((goal) => {
          goalsTotal += 1;

          let playerId = goal.playerId;
          const hasUuid =
            typeof goal.playerUuid === "string" &&
            goal.playerUuid.startsWith("pl_");
          const playerIdIsPl =
            typeof playerId === "string" && playerId.startsWith("pl_");
          const playerIdIsLegacy =
            typeof playerId === "string" && playerId.startsWith("p_");

          if (playerIdIsPl) {
            goalsAlready += 1;
          } else if (hasUuid) {
            playerId = goal.playerUuid;
            goalsPlayerIdConverted += 1;
          } else if (playerIdIsLegacy) {
            uncertain += 1;
            report.warnings.push(
              `goal missing playerUuid for legacy ${playerId} in ${match.id}`
            );
          } else {
            uncertain += 1;
            report.warnings.push(
              `goal missing permanent player id in ${match.id}`
            );
          }

          let id = goal.id;
          if (typeof id !== "string" || id.length === 0) {
            id = crypto.randomUUID();
            goalsIdsAdded += 1;
          }

          return {
            id,
            playerId,
            teamId: goal.teamId,
            half: goal.half,
            minute: goal.minute,
            isOwnGoal: Boolean(goal.isOwnGoal),
            ...(goal.assistPlayerId
              ? { assistPlayerId: goal.assistPlayerId }
              : {}),
            ...(goal.type ? { type: goal.type } : {}),
          };
        });

        return {
          ...match,
          goals: nextGoals,
        };
      });

      writeJson(filePath, nextMatches);
      report.matches[`${seasonId}/${divisionId}`] = {
        matchCount: matches.length,
      };
    }
  }

  report.goals = {
    total: goalsTotal,
    idsAdded: goalsIdsAdded,
    playerIdConverted: goalsPlayerIdConverted,
    alreadyPl: goalsAlready,
    uncertain,
  };
}

function removeLeagueJson(report) {
  const removed = [];
  for (const seasonId of listSeasonDirs()) {
    for (const divisionId of listDivisionDirs(seasonId)) {
      const filePath = path.join(
        DATA,
        "seasons",
        seasonId,
        "division",
        divisionId,
        "league.json"
      );
      if (!fs.existsSync(filePath)) {
        continue;
      }
      removed.push(path.relative(ROOT, filePath));
      if (!dryRun) {
        fs.unlinkSync(filePath);
      }
    }
  }
  report.leagueJsonRemoved = removed;
}

function main() {
  fs.mkdirSync(REPORTS, { recursive: true });
  const report = {
    dryRun,
    startedAt: new Date().toISOString(),
    warnings: [],
  };

  migratePlayers(report);
  migrateRegistrations(report);
  migrateMatchGoals(report);
  removeLeagueJson(report);

  report.finishedAt = new Date().toISOString();
  const reportName = dryRun
    ? `migration-dry-run-${Date.now()}.json`
    : `migration-${Date.now()}.json`;
  const reportPath = path.join(REPORTS, reportName);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(JSON.stringify(report, null, 2));
  console.log(`\nReport written: ${path.relative(ROOT, reportPath)}`);
  if (dryRun) {
    console.log("Dry run only — no files were modified.");
  }
}

main();
