# TODO

> 기준: masters / seasons (`pl_*`, `season.json`, `league.json` 없음)

## Done

- [x] 선수 `id: pl_*` + 골 `playerId: pl_*` + 골 고유 `id`
- [x] registrations에서 `divisionId` / `legacyPlayerId` 제거
- [x] `league.json` 제거 (`season.json` 원본)
- [x] public 프런트 스키마 대응 (`feature/#1`)
- [x] 2026-2027 FK1/FK2 전체 일정 (fk1 45 / fk2 42)
- [x] 2026-2027 1R 기록지 기반 등록·골·이적 초안 (regs 166)
- [x] 인천 `t_incheon` / `t_incheon_zd` 신규 클럽 (전주·LB·남동 제외)
- [x] 문서 동기화 (`DATA_STRUCTURE` / `ADMIN` / `MIGRATION_*` / `README`)

## Remaining

### 데이터

- [ ] `matches.json`에 `lineups` 추가 (`pl_*`)
- [ ] score vs goals 불일치 (2025-2026 기존 크롤) 원본 확인 후 보정
- [ ] 2026-2027 이후 라운드 기록지로 로스터·골 보강 (군산 등 미출전 팀 포함)
- [ ] 인천 클럽 로고·구장 등 프로필 정식 반영 (`logo` 등 placeholder 교체)
- [ ] `masters/players` `position` 미기입 보완
- [ ] 시즌 종료 시 `endDate` 닫기 정책 확정·적용

### 앱

- [ ] Admin(`futsal-league-admin`) `playerUuid` → `playerId` 후속 대응
- [ ] (선택) public 기본 시즌을 `2026-2027`로

### 배포

- [ ] data `main` 머지 → public `main` 머지 순으로 반영
