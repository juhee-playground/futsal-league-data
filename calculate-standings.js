const fs = require('fs');
const path = require('path');

const leagues = ['fk1', 'fk2', 'wk'];
const baseDir = path.join(__dirname, 'data', 'seasons', '2025-2026', 'division');

leagues.forEach((league) => {
  const leaguePath = path.join(baseDir, league);
  const matchesPath = path.join(leaguePath, 'matches.json');
  const teamsPath = path.join(leaguePath, 'teams.json');
  const standingsPath = path.join(leaguePath, 'standings.json');
  const scorersPath = path.join(leaguePath, 'scorers.json');

  if (!fs.existsSync(matchesPath) || !fs.existsSync(teamsPath)) {
    console.log(`⏭️  [${league}] matches.json 또는 teams.json 없음, 스킵`);
    return;
  }

  const matches = JSON.parse(fs.readFileSync(matchesPath, 'utf-8'));
  const teams = JSON.parse(fs.readFileSync(teamsPath, 'utf-8'));

  // 1. 팀별 초기 통계
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

  const playerGoals = {};
  const finishedMatches = matches.filter((m) => m.status === 'FINISHED');

  finishedMatches.forEach((match) => {
    const { homeTeamId, awayTeamId, score, goals = [] } = match;

    if (!score || score.home === undefined || score.away === undefined) {
      console.warn(`⚠️  [${league}] 경기 ${match.id}에 점수 정보가 없습니다.`);
      return;
    }

    const homeScore = score.home;
    const awayScore = score.away;

    standings[homeTeamId].gf += homeScore;
    standings[homeTeamId].ga += awayScore;
    standings[awayTeamId].gf += awayScore;
    standings[awayTeamId].ga += awayScore;
    standings[homeTeamId].played += 1;
    standings[awayTeamId].played += 1;

    if (homeScore > awayScore) {
      standings[homeTeamId].win += 1;
      standings[homeTeamId].points += 3;
      standings[awayTeamId].loss += 1;
    } else if (homeScore < awayScore) {
      standings[awayTeamId].win += 1;
      standings[awayTeamId].points += 3;
      standings[homeTeamId].loss += 1;
    } else {
      standings[homeTeamId].draw += 1;
      standings[awayTeamId].draw += 1;
      standings[homeTeamId].points += 1;
      standings[awayTeamId].points += 1;
    }

    goals.filter((g) => !g.isOwnGoal).forEach((goal) => {
      if (!playerGoals[goal.playerId]) {
        playerGoals[goal.playerId] = { playerId: goal.playerId, teamId: goal.teamId, goals: 0 };
      }
      playerGoals[goal.playerId].goals += 1;
    });
  });

  Object.values(standings).forEach((t) => { t.gd = t.gf - t.ga; });

  const sortedStandings = Object.values(standings).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gd !== a.gd) return b.gd - a.gd;
    return b.gf - a.gf;
  });

  const sortedScorers = Object.values(playerGoals).sort((a, b) => {
    if (b.goals !== a.goals) return b.goals - a.goals;
    return a.playerId.localeCompare(b.playerId);
  });

  fs.writeFileSync(standingsPath, JSON.stringify(sortedStandings, null, 2), 'utf-8');
  fs.writeFileSync(scorersPath, JSON.stringify(sortedScorers, null, 2), 'utf-8');

  console.log(`✅ [${league}] 경기 ${finishedMatches.length}경기, 팀 ${sortedStandings.length}팀, 득점자 ${sortedScorers.length}명`);
});
