const fs = require("fs");
const path = require("path");

// 리그 목록 (폴더 이름)
const leagues = ["fk1", "fk2", "wk"];
const baseDir = path.join(__dirname, "2025-2026", "division");

leagues.forEach((league) => {
  const leaguePath = path.join(baseDir, league);
  const matchesPath = path.join(leaguePath, "matches.json");
  const teamsPath = path.join(leaguePath, "teams.json");
  const standingsPath = path.join(leaguePath, "standings.json");

  // 파일 존재 여부 확인
  if (!fs.existsSync(matchesPath) || !fs.existsSync(teamsPath)) {
    console.log(`[${league}] 데이터 파일이 없어 건너뜁니다.`);
    return;
  }

  const matches = JSON.parse(fs.readFileSync(matchesPath, "utf-8"));
  const teams = JSON.parse(fs.readFileSync(teamsPath, "utf-8"));

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

  matches
    .filter((m) => m.status === "FINISHED")
    .forEach((match) => {
      const { homeTeamId, awayTeamId, score } = match;
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
    });

  const result = Object.values(standings)
    .map((t) => ({ ...t, gd: t.gf - t.ga }))
    .sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);

  fs.writeFileSync(standingsPath, JSON.stringify(result, null, 2));
  console.log(`✅ [${league}] 순위표 업데이트 완료!`);
});
