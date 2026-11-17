# 마이그레이션 결과

## 1) 스키마 마이그레이션 (2025-2026 기준)

| 항목 | 결과 |
|------|------|
| players `uuid` → `id` | 401 → 이후 신규 포함 **443** |
| registrations 필드 정리 | 2025-2026: 401 |
| goals `playerId` → `pl_*` | 731 (당시) |
| goals `id` 추가 | 누락분 생성 |
| `league.json` 삭제 | fk1/fk2/wk 3개 |
| validation errors | 0 |

## 2) 2026-2027 초안 (기록지 기반)

| 항목 | 결과 |
|------|------|
| FK1 matches | 45 (종료 3경기 골 반영) |
| FK2 matches | 42 (종료 3경기 골 반영) |
| player_registrations | **166** (FK1+FK2 1R 출전 명단) |
| 이적 추적 | 25-26 vs 26-27 `teamId` 비교 |
| 동명이인 | 신규 `pl_*` 분리 (김재훈·김성빈 등) |
| 인천 신규 클럽 | `t_incheon`, `t_incheon_zd` (프로필 placeholder) |

## 3) 경고 (수정하지 않음)

- 2025-2026 score vs goals 불일치 FINISHED 경기 (기존 크롤) — 리포트만
- 상세는 로컬 `reports/validation-*.json` (gitignore)

## 4) 레거시 맵

- `reports/legacy-player-id-map.json` — `p_*` → `pl_*` (gitignore)

## 5) 프런트 (`futsal-league-public`)

- `season.json` + `divisions.json`로 리그 메타 조립
- 선수/골 조인 키: `pl_*`
- 팀 표시명: `team_seasons.name` 우선
- 시즌 목록에 `2026-2027` (fk1/fk2) 추가 (기본 시즌은 아직 2025-2026)

## 6) 배포 주의

**data `main` 머지 후** public 배포.  
순서가 바뀌면 구 public이 `league.json` / `uuid`를 찾다 실패한다.
