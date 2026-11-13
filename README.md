# Futsal League Data

FK1 / FK2 / WK 리그 경기·선수·팀 데이터입니다.

순위표와 득점 순위는 `matches.json`의 `goals`를 기준으로 계산합니다.

## 데이터 구조

팀·선수는 **영구 마스터**, 디비전 소속·이적은 **시즌 관계**로 분리합니다.

```
data/
  masters/
    divisions.json   # 디비전 마스터
    teams.json       # 팀 마스터 (디비전 무관)
    players.json     # 선수 마스터 (팀 무관, uuid 기준)
  seasons/
    2025-2026/
      season.json
      team_seasons.json          # 시즌별 팀 ↔ 디비전
      player_registrations.json  # 시즌별 선수 ↔ 팀 (이적 이력)
      division/
        fk1|fk2|wk/
          league.json
          matches.json
```

## 경로

### 마스터

- 디비전: `data/masters/divisions.json`
- 팀: `data/masters/teams.json`
- 선수: `data/masters/players.json`

### 2025-2026 시즌

- 시즌 메타: `data/seasons/2025-2026/season.json`
- 팀 소속: `data/seasons/2025-2026/team_seasons.json`
- 선수 등록: `data/seasons/2025-2026/player_registrations.json`
- FK1 경기: `data/seasons/2025-2026/division/fk1/`
- FK2 경기: `data/seasons/2025-2026/division/fk2/`
- WK 경기: `data/seasons/2025-2026/division/wk/`

## 승격·강등 / 이적

| 이벤트 | 처리 |
|--------|------|
| 승격·강등 | 다음 시즌 `team_seasons`에 다른 `divisionId`로 row 추가 |
| 이적 | 기존 `player_registrations.endDate` 종료 후, 새 팀으로 row 추가 |

스키마 상세는 [ADMIN_DATA_FORMAT.md](./ADMIN_DATA_FORMAT.md)를 참고하세요.
