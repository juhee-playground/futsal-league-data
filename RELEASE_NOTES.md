# Release Notes — `feature/#1`

**대상:** `futsal-league-data` (공개 데이터 저장소)  
**연동:** `futsal-league-public` 동일 브랜치 스키마 대응 필요  
**배포 순서:** data `main` 머지 → public 배포

---

## Highlights

1. **선수·골 ID 통일** — `uuid` / `p_*` → `pl_*`
2. **시즌 스키마 정리** — `league.json` 제거, `season.json` + masters 기준
3. **2026-2027 시즌 초안** — FK1/FK2 일정 + 1R 기록지 등록·골·이적

---

## Breaking Changes

| 이전 | 이후 |
|------|------|
| `masters/players[].uuid` | `masters/players[].id` (`pl_*`) |
| goals `playerId` = legacy / uuid | goals `playerId` = `pl_*` |
| `seasons/*/division/*/league.json` | **삭제** → `season.json` + `masters/divisions.json` |
| registrations `divisionId`, `legacyPlayerId` | **삭제** (디비전은 `team_seasons`로 유도) |

구 public이 data만 먼저 받으면 `league.json` / `uuid` 조회로 깨집니다.

---

## Added

### 스키마·도구

- `player_registrations` 기반 소속·이적 (`endDate` + 새 row)
- `team_seasons` 시즌별 구단명·디비전
- `scripts/migration/migrate-all.mjs`, `scripts/validation/validate-all.mjs`

### 2026-2027

| 항목 | 내용 |
|------|------|
| FK1 matches | 45경기 (1R 종료분 골 반영) |
| FK2 matches | 42경기 (1R 종료분 골 반영) |
| registrations | 166 (1R 출전 명단 초안) |
| 신규 클럽 | `t_incheon`, `t_incheon_zd` (프로필 placeholder) |
| 제외 | 전주 잔류 처리 / LB·남동 미포함 |

이적: 25-26 vs 26-27 `teamId` 비교. 동명이인(김재훈·김성빈 등)은 신규 `pl_*`.

---

## Changed

- 문서: `DATA_STRUCTURE`, `ADMIN_DATA_FORMAT`, `MIGRATION_RESULT`, `MIGRATION_PLAN`, `README`, `TODO`
- public 팀 마스터 파서 필수 필드: `location`, `address`, `logo`, `color`, `darkColor` (빈 문자열 허용)

---

## Known Issues / Not in this release

- `lineups` 미포함
- 2025-2026 score vs goals 불일치 (기존 크롤) — 경고만, 임의 보정 없음
- 2026-2027 미출전 팀 로스터·이후 라운드 미보강
- 인천 로고·구장 등 정식 프로필 미반영
- `masters/players` position 일부 공란
- Admin `playerUuid` → `playerId` 미대응
- public 기본 시즌은 아직 `2025-2026`

---

## Upgrade checklist

1. [ ] data `feature/#1` → `main` 머지
2. [ ] public 스키마 대응 브랜치 → `main` 머지·배포
3. [ ] `node scripts/validation/validate-all.mjs` errors 0 확인
4. [ ] (선택) public 기본 시즌을 `2026-2027`로 전환
