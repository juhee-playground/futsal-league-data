# Admin / 서비스용 데이터 형식

팀·선수는 마스터, 시즌 소속·이적은 관계 파일로 관리합니다.

## 1) 디렉터리

```
data/
  masters/
    divisions.json
    teams.json
    players.json
  seasons/{seasonId}/
    season.json
    team_seasons.json
    player_registrations.json
    division/{fk1|fk2|wk}/
      matches.json
```

`league.json`은 사용하지 않습니다. 디비전 메타는 `season.json`이 원본입니다.

## 2) 마스터

### `masters/divisions.json`

```json
{ "id": "fk1", "name": "FK 1부 리그", "leagueId": "division-1" }
```

### `masters/teams.json`

```json
{
  "id": "t_goyang",
  "name": "고양불스풋살클럽",
  "status": "ACTIVE",
  "color": "#e7b573",
  "darkColor": "#fbbf24",
  "logo": "team_goyang.jpg",
  "address": "string",
  "location": "string",
  "homepage": "string"
}
```

- `divisionId` 없음
- `name`: 현재 구단명. 과거 시즌명은 `team_seasons.name`

### `masters/players.json`

```json
{ "id": "pl_0124", "name": "홍길동", "position": "ALA" }
```

- `id`: 영구 선수 ID (`pl_*`)
- 팀/등번호 없음

## 3) 시즌

### `season.json`

```json
{
  "id": "2025-2026",
  "name": "2025-2026 시즌",
  "divisions": [
    {
      "divisionId": "fk1",
      "name": "2025-2026 FK 1부 리그",
      "startDate": "2025-11-15",
      "endDate": "2026-04-04",
      "rounds": 14,
      "pointRule": { "win": 3, "draw": 1, "loss": 0 }
    }
  ]
}
```

### `team_seasons.json`

```json
{
  "id": "ts_2026-2027_yongin",
  "teamId": "t_yongin",
  "seasonId": "2026-2027",
  "divisionId": "fk1",
  "name": "용인지솔FS",
  "status": "ACTIVE"
}
```

### `player_registrations.json`

```json
{
  "id": "pr_pl_0124_2025-2026_goyang",
  "seasonId": "2025-2026",
  "playerId": "pl_0124",
  "teamId": "t_goyang",
  "shirtNumber": 7,
  "startDate": "2025-11-15",
  "endDate": null
}
```

이적: 기존 row `endDate` 설정 후 새 row 추가.  
디비전은 `teamId` → `team_seasons`로 조회.

## 4) `matches.json`

```json
{
  "id": "m_45",
  "round": 15,
  "date": "2026-03-29",
  "time": "14:00",
  "place": "춘천호반체육관",
  "homeTeamId": "t_gangwon",
  "awayTeamId": "t_goyang",
  "status": "FINISHED",
  "youtube_url": "",
  "goals": [
    {
      "id": "f9615ec4-a602-42ba-a7c7-e8c05c1ca05f",
      "playerId": "pl_0086",
      "teamId": "t_gangwon",
      "half": 2,
      "minute": 9,
      "isOwnGoal": false
    }
  ],
  "score": { "home": 3, "away": 6 }
}
```

- `goals[].playerId`: `pl_*` (masters/players.id)
- `goals[].teamId`: 득점 인정 팀 (자책골 시 소속과 다를 수 있음)
- 경기 ID: FK1 `m_*` / FK2 `m_fk2_*` / WK `m_w_*`

## 5) 조회 가이드

| 질문 | 소스 |
|------|------|
| 시즌 FK1 팀 | `team_seasons` + `masters/teams` (`name`은 team_seasons 우선) |
| 현재 로스터 | `player_registrations` where `endDate=null` + team_seasons로 디비전 필터 |
| 골 → 선수 | `goals.playerId` → `masters/players.id` |
