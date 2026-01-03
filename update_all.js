const fs = require("fs");
const path = require("path");

// 리그 목록 및 경로 설정
const leagues = ["fk1", "fk2", "wk"];
const baseDir = path.join(__dirname, "2025-2026", "division");

leagues.forEach((league) => {
  const leaguePath = path.join(baseDir, league);
  const matchesPath = path.join(leaguePath, "matches.json");
  const teamsPath = path.join(leaguePath, "teams.json");
  const standingsPath = path.join(leaguePath, "standings.json");
  const scorersPath = path.join(leaguePath, "scorers.json");

  if (!fs.existsSync(matchesPath) || !fs.existsSync(teamsPath)) return;

  const matches = JSON.parse(fs.readFileSync(matchesPath, "utf-8"));
  const teams = JSON.parse(fs.readFileSync(teamsPath, "utf-8"));

  // 1. 순위표(Standings) 초기화 및 계산
  const standings = teams.reduce((acc, team) => {
    acc[team.id] = {
      teamId: team.id,
      played: 0,
      win: 0,
      draw: 0,
      loss: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      points: 0,
    };
    return acc;
  }, {});

  // 2. 득점자(Scorers) 집계를 위한 객체
  const playerGoals = {};

  matches
    .filter((m) => m.status === "FINISHED")
    .forEach((match) => {
      const { homeTeamId, awayTeamId, score, goals } = match;

      // 순위표 계산
      const h = standings[homeTeamId];
      const a = standings[awayTeamId];
      h.played++;
      a.played++;
      h.gf += score.home;
      h.ga += score.away;
      a.gf += score.away;
      a.ga += score.home;

      if (score.home > score.away) {
        h.win++;
        h.points += 3;
        a.loss++;
      } else if (score.home < score.away) {
        a.win++;
        a.points += 3;
        h.loss++;
      } else {
        h.draw++;
        h.points += 1;
        a.draw++;
        a.points += 1;
      }

      // 득점자 집계 (matches.json의 goals 배열 활용)
      if (goals && Array.isArray(goals)) {
        goals.forEach((goal) => {
          if (!playerGoals[goal.playerId]) {
            playerGoals[goal.playerId] = {
              playerId: goal.playerId,
              goals: 0,
              teamId: goal.teamId,
            };
          }
          playerGoals[goal.playerId].goals++;
        });
      }
    });

  // 순위표 정렬 및 저장
  const sortedStandings = Object.values(standings)
    .map((t) => ({ ...t, gd: t.gf - t.ga }))
    .sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
  fs.writeFileSync(standingsPath, JSON.stringify(sortedStandings, null, 2));

  // 득점 순위 정렬 및 저장
  const sortedScorers = Object.values(playerGoals).sort(
    (a, b) => b.goals - a.goals || a.playerId.localeCompare(b.playerId)
  );
  fs.writeFileSync(scorersPath, JSON.stringify(sortedScorers, null, 2));

  console.log(`✅ [${league}] 순위표 및 득점 순위 업데이트 완료!`);
});
