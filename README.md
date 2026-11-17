# Futsal League Data

FK1 / FK2 / WK 리그 경기·선수·팀 데이터입니다.

순위표와 득점 순위는 `matches.json`의 `goals`를 기준으로 계산합니다.

## 문서

| 문서 | 용도 |
|------|------|
| [DATA_STRUCTURE.md](./DATA_STRUCTURE.md) | 현재 구조·이적/승강 |
| [ADMIN_DATA_FORMAT.md](./ADMIN_DATA_FORMAT.md) | 필드 스키마 |
| [MIGRATION_PLAN.md](./MIGRATION_PLAN.md) | 마이그레이션 계획·결과 |
| [TODO.md](./TODO.md) | 남은 작업 |

## 구조

```
data/
  masters/{divisions,teams,players}.json
  seasons/{seasonId}/
    season.json
    team_seasons.json
    player_registrations.json
    division/{fk1|fk2|wk}/matches.json
```

선수 ID는 `pl_*`입니다. 골의 `playerId`도 동일합니다.

## 스크립트

```bash
node scripts/migration/migrate-all.mjs --dry-run
node scripts/migration/migrate-all.mjs
node scripts/validation/validate-all.mjs
```

## 승격·강등 / 이적

| 이벤트 | 처리 |
|--------|------|
| 승격·강등 | 다음 시즌 `team_seasons`에 다른 `divisionId` |
| 구단명 변경 | `teamId` 유지, `team_seasons.name`에 시즌명 |
| 이적 | `player_registrations` endDate 종료 후 새 row |
