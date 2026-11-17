#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const DATA = path.join(ROOT, "data");
const REPORTS = path.join(ROOT, "reports");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function listSeasonDirs() {
  return fs
    .readdirSync(path.join(DATA, "seasons"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function listDivisionDirs(seasonId) {
  const root = path.join(DATA, "seasons", seasonId, "division");
  if (!fs.existsSync(root)) {
    return [];
  }
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function main() {
  const errors = [];
  const warnings = [];
  const summary = {};

  const teams = readJson(path.join(DATA, "masters", "teams.json"));
  const players = readJson(path.join(DATA, "masters", "players.json"));
  const divisions = readJson(path.join(DATA, "masters", "divisions.json"));

  const teamIds = new Set(teams.map((t) => t.id));
  const playerIds = new Set(players.map((p) => p.id));
  const divisionIds = new Set(divisions.map((d) => d.id));

  if (teamIds.size !== teams.length) {
    errors.push("duplicate team id in masters/teams.json");
  }
  if (playerIds.size !== players.length) {
    errors.push("duplicate player id in masters/players.json");
  }
  if (players.some((p) => !p.id || p.uuid)) {
    errors.push("players must use id (pl_*) and must not keep uuid");
  }

  summary.masters = {
    teams: teams.length,
    players: players.length,
    divisions: divisions.length,
  };

  let matchCount = 0;
  let goalCount = 0;
  const goalIds = new Set();
  const scoreMismatches = [];

  for (const seasonId of listSeasonDirs()) {
    const seasonPath = path.join(DATA, "seasons", seasonId, "season.json");
    const season = readJson(seasonPath);
    if (season.id !== seasonId) {
      errors.push(`season id mismatch: dir=${seasonId} id=${season.id}`);
    }

    const seasonDivisionIds = new Set(
      (season.divisions ?? []).map((d) => d.divisionId)
    );
    for (const divisionId of seasonDivisionIds) {
      if (!divisionIds.has(divisionId)) {
        errors.push(`unknown division ${divisionId} in ${seasonId}/season.json`);
      }
    }

    const teamSeasonsPath = path.join(
      DATA,
      "seasons",
      seasonId,
      "team_seasons.json"
    );
    const teamSeasons = readJson(teamSeasonsPath);
    const teamSeasonKeys = new Set();
    for (const row of teamSeasons) {
      if (!teamIds.has(row.teamId)) {
        errors.push(`${seasonId} team_seasons unknown team ${row.teamId}`);
      }
      if (!divisionIds.has(row.divisionId)) {
        errors.push(
          `${seasonId} team_seasons unknown division ${row.divisionId}`
        );
      }
      if (row.seasonId !== seasonId) {
        errors.push(`${seasonId} team_seasons seasonId mismatch ${row.id}`);
      }
      const key = `${row.teamId}:${row.divisionId}`;
      if (teamSeasonKeys.has(key)) {
        errors.push(`${seasonId} duplicate team_seasons ${key}`);
      }
      teamSeasonKeys.add(key);
    }

    const teamDivisionByTeamId = new Map(
      teamSeasons.map((row) => [row.teamId, row.divisionId])
    );

    const regsPath = path.join(
      DATA,
      "seasons",
      seasonId,
      "player_registrations.json"
    );
    let registrations = [];
    if (fs.existsSync(regsPath)) {
      registrations = readJson(regsPath);
      for (const row of registrations) {
        if (!playerIds.has(row.playerId)) {
          errors.push(
            `${seasonId} registration unknown player ${row.playerId}`
          );
        }
        if (!teamIds.has(row.teamId)) {
          errors.push(`${seasonId} registration unknown team ${row.teamId}`);
        }
        if (row.playerUuid || row.legacyPlayerId || row.divisionId) {
          errors.push(
            `${seasonId} registration still has legacy fields: ${row.id}`
          );
        }
        if (!teamDivisionByTeamId.has(row.teamId)) {
          warnings.push(
            `${seasonId} registration team not in team_seasons: ${row.teamId}`
          );
        }
      }
    }

    for (const divisionId of listDivisionDirs(seasonId)) {
      const leaguePath = path.join(
        DATA,
        "seasons",
        seasonId,
        "division",
        divisionId,
        "league.json"
      );
      if (fs.existsSync(leaguePath)) {
        errors.push(`league.json should be removed: ${seasonId}/${divisionId}`);
      }

      const matchesPath = path.join(
        DATA,
        "seasons",
        seasonId,
        "division",
        divisionId,
        "matches.json"
      );
      if (!fs.existsSync(matchesPath)) {
        continue;
      }

      const matches = readJson(matchesPath);
      const matchIds = new Set();
      matchCount += matches.length;

      for (const match of matches) {
        if (matchIds.has(match.id)) {
          errors.push(`duplicate match id ${match.id}`);
        }
        matchIds.add(match.id);

        if (!teamIds.has(match.homeTeamId) || !teamIds.has(match.awayTeamId)) {
          errors.push(`match ${match.id} unknown team`);
        }

        const homeDiv = teamDivisionByTeamId.get(match.homeTeamId);
        const awayDiv = teamDivisionByTeamId.get(match.awayTeamId);
        if (homeDiv && homeDiv !== divisionId) {
          warnings.push(
            `match ${match.id} home team division ${homeDiv} != ${divisionId}`
          );
        }
        if (awayDiv && awayDiv !== divisionId) {
          warnings.push(
            `match ${match.id} away team division ${awayDiv} != ${divisionId}`
          );
        }

        let calcHome = 0;
        let calcAway = 0;
        for (const goal of match.goals ?? []) {
          goalCount += 1;
          if (!goal.id) {
            errors.push(`match ${match.id} goal missing id`);
          } else if (goalIds.has(goal.id)) {
            errors.push(`duplicate goal id ${goal.id}`);
          } else {
            goalIds.add(goal.id);
          }

          if (!playerIds.has(goal.playerId)) {
            errors.push(
              `match ${match.id} goal unknown player ${goal.playerId}`
            );
          }
          if (!String(goal.playerId ?? "").startsWith("pl_")) {
            errors.push(
              `match ${match.id} goal playerId not pl_*: ${goal.playerId}`
            );
          }
          if (goal.playerUuid) {
            errors.push(`match ${match.id} goal still has playerUuid`);
          }
          if (!teamIds.has(goal.teamId)) {
            errors.push(`match ${match.id} goal unknown team ${goal.teamId}`);
          }

          if (goal.teamId === match.homeTeamId) {
            calcHome += 1;
          } else if (goal.teamId === match.awayTeamId) {
            calcAway += 1;
          }
        }

        if (
          match.status === "FINISHED" &&
          match.score &&
          (calcHome !== match.score.home || calcAway !== match.score.away)
        ) {
          scoreMismatches.push({
            seasonId,
            divisionId,
            matchId: match.id,
            score: match.score,
            calc: { home: calcHome, away: calcAway },
            goals: (match.goals ?? []).length,
          });
        }
      }
    }

    summary[seasonId] = {
      teamSeasons: teamSeasons.length,
      registrations: registrations.length,
      divisions: [...seasonDivisionIds],
    };
  }

  summary.matches = matchCount;
  summary.goals = goalCount;
  summary.scoreMismatchCount = scoreMismatches.length;

  const report = {
    ok: errors.length === 0,
    summary,
    errors,
    warnings,
    scoreMismatches,
    finishedAt: new Date().toISOString(),
  };

  fs.mkdirSync(REPORTS, { recursive: true });
  const reportPath = path.join(REPORTS, `validation-${Date.now()}.json`);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nReport: ${path.relative(ROOT, reportPath)}`);
  process.exitCode = errors.length === 0 ? 0 : 1;
}

main();
