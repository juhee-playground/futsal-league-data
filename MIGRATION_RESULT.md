# 마이그레이션 결과

## 적용 내용

| 항목 | 결과 |
|------|------|
| players `uuid` → `id` | 401 |
| registrations 필드 정리 | 401 (2025-2026) |
| goals `playerId` → `pl_*` | 731 |
| goals `id` 추가 | 719 (기존 12 유지) |
| `league.json` 삭제 | fk1/fk2/wk 3개 |
| 경기 수 | 121 (불변) |
| 골 수 | 731 (불변) |
| validation errors | 0 |

## 경고 (수정하지 않음)

- score vs goals 불일치 FINISHED 경기 **34건** (기존 크롤 데이터)
- 상세는 로컬 `reports/validation-*.json` 참고

## 레거시 맵

- `reports/legacy-player-id-map.json` (401행, gitignore)
- `p_*` → `pl_*` 대응

## 프런트 (`futsal-league-public`)

- `season.json` + `divisions.json`로 리그 메타 조립
- 선수/골 조인 키: `pl_*`
- 팀 표시명: `team_seasons.name` 우선
- 시즌 목록에 `2026-2027` (fk1/fk2) 추가

## 배포 주의

**data repo `main`과 public 배포를 같이** 올려야 합니다.  
data만 먼저 올리면 기존 public이 `league.json` / `uuid` / `legacyPlayerId`를 찾다 실패합니다.
