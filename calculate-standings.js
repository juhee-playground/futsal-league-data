const fs = require('fs');
const path = require('path');

const seasonPath = path.join(__dirname, 'data', 'seasons', '2025-2026');
const matchesPath = path.join(seasonPath, 'matches.json');
const teamsPath = path.join(seasonPath, 'teams.json');
const standingsPath = path.join(seasonPath, 'standings.json');

// 파일 읽기
const matches = JSON.parse(fs.readFileSync(matchesPath, 'utf-8'));
const teams = JSON.parse(fs.readFileSync(teamsPath, 'utf-8'));

// 팀별 초기 통계 초기화
const standings = teams.reduce((acc, team) => {
  acc[team.id] = {
    teamId: team.id,
    played: 0,
    win: 0,
    draw: 0,
    loss: 0,
    gf: 0, // goals for (득점)
    ga: 0, // goals against (실점)
    gd: 0, // goal difference (득실차)
    points: 0
  };
  return acc;
}, {});

// FINISHED 상태인 경기만 처리
const finishedMatches = matches.filter(match => match.status === 'FINISHED');

finishedMatches.forEach(match => {
  const { homeTeamId, awayTeamId, score } = match;
  
  if (!score || score.home === undefined || score.away === undefined) {
    console.warn(`경기 ${match.id}에 점수 정보가 없습니다.`);
    return;
  }

  const homeScore = score.home;
  const awayScore = score.away;

  // 득점/실점 업데이트
  standings[homeTeamId].gf += homeScore;
  standings[homeTeamId].ga += awayScore;
  standings[awayTeamId].gf += awayScore;
  standings[awayTeamId].ga += homeScore;

  // 경기 수 증가
  standings[homeTeamId].played += 1;
  standings[awayTeamId].played += 1;

  // 승/무/패 및 승점 계산
  if (homeScore > awayScore) {
    // 홈팀 승리
    standings[homeTeamId].win += 1;
    standings[homeTeamId].points += 3;
    standings[awayTeamId].loss += 1;
  } else if (homeScore < awayScore) {
    // 원정팀 승리
    standings[awayTeamId].win += 1;
    standings[awayTeamId].points += 3;
    standings[homeTeamId].loss += 1;
  } else {
    // 무승부
    standings[homeTeamId].draw += 1;
    standings[homeTeamId].points += 1;
    standings[awayTeamId].draw += 1;
    standings[awayTeamId].points += 1;
  }
});

// 득실차 계산
Object.values(standings).forEach(team => {
  team.gd = team.gf - team.ga;
});

// 순위 정렬 (승점 > 득실차 > 득점 순)
const sortedStandings = Object.values(standings).sort((a, b) => {
  // 1순위: 승점
  if (b.points !== a.points) {
    return b.points - a.points;
  }
  // 2순위: 득실차
  if (b.gd !== a.gd) {
    return b.gd - a.gd;
  }
  // 3순위: 득점
  return b.gf - a.gf;
});

// 파일 저장
fs.writeFileSync(standingsPath, JSON.stringify(sortedStandings, null, 2), 'utf-8');

console.log('순위표가 성공적으로 계산되었습니다!');
console.log(`총 ${finishedMatches.length}경기를 처리했습니다.`);

