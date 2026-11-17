# 현재 데이터 구조 (As-Is)

> 마이그레이션 반영 후 기준 (`scripts/migration/migrate-all.mjs`)

---

## 1. 한 줄 요약

| 개념 | 어디에 있나 | 바뀌는 단위 |
|------|-------------|-------------|
| 팀 정체성 (`t_*`) | `masters/teams.json` | 영구 |
| 선수 정체성 (`pl_*`) | `masters/players.json` (`id`) | 영구 |
| 디비전 (`fk1`/`fk2`/`wk`) | `masters/divisions.json` | 거의 불변 |
| 시즌 참가·당시 구단명 | `seasons/{id}/team_seasons.json` | 시즌마다 |
| 선수 소속·등번호·이적 | `seasons/{id}/player_registrations.json` | 소속 기간마다 |
| 경기·골 | `seasons/{id}/division/{div}/matches.json` | 시즌·디비전 |
| 시즌·디비전 메타 | `seasons/{id}/season.json` | 시즌 |

`league.json`은 **제거됨**. 프런트는 `season.json` + `divisions.json`으로 메타를 조립한다.

---

## 2. 디렉터리

```
data/
  masters/
    divisions.json
    teams.json
    players.json          # { id: "pl_*", name, position? }
  seasons/
    2025-2026/
      season.json
      team_seasons.json
      player_registrations.json
      division/{fk1,fk2,wk}/matches.json
    2026-2027/
      season.json
      team_seasons.json
      player_registrations.json   # 1R 기록지 기반 초안 (미출전 팀 로스터 미완)
      division/fk1/matches.json   # 45경기
      division/fk2/matches.json   # 42경기
```

---

## 3. 스키마 요약

### `masters/players.json`

```json
{ "id": "pl_0124", "name": "홍길동", "position": "ALA" }
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

- `divisionId` 없음 → `team_seasons`로 유도
- 이적: 기존 `endDate` 종료 + 새 row

### `matches.json` goals

```json
{
  "id": "uuid",
  "playerId": "pl_0124",
  "teamId": "t_goyang",
  "half": 1,
  "minute": 5,
  "isOwnGoal": false
}
```

- `playerId` = 영구 ID (`pl_*`)
- 구 `p_*` 매핑은 `reports/legacy-player-id-map.json` (gitignore)

### `team_seasons.json`

승강·시즌 구단명 원천. `teamId` 불변, `divisionId`·`name`만 시즌별.

---

## 4. 이벤트 처리

| 이벤트 | 처리 |
|--------|------|
| 시즌 중 이적 | registrations `endDate` + 새 row |
| 다음 시즌 | 새 시즌 폴더 + registrations / matches |
| 승격·강등 | 다음 `team_seasons.divisionId` |
| 구단명 변경 | `team_seasons.name` (+ 마스터 현재명) |

---

## 5. 도구

```bash
node scripts/migration/migrate-all.mjs --dry-run
node scripts/migration/migrate-all.mjs
node scripts/validation/validate-all.mjs
```

백업: `backups/` (gitignore)

---

## 6. 관련 문서

- [ADMIN_DATA_FORMAT.md](./ADMIN_DATA_FORMAT.md)
- [MIGRATION_PLAN.md](./MIGRATION_PLAN.md)
- [TODO.md](./TODO.md)
