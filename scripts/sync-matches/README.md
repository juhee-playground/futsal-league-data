# 경기 기록 동기화

futsal.or.kr 기록지를 읽어 `matches.json` 스코어·골을 반영합니다.
골 `playerId`는 `pl_*`로 매핑하고, 없는 선수는 masters/registrations에 추가합니다.

## 로컬

```bash
cd scripts/sync-matches
pnpm install

node sync-matches.js fk1                    # 날짜 지났는데 SCHEDULED만
node sync-matches.js fk2 --date 2026-11-21
node sync-matches.js fk1 --date 2026-11-21,2026-11-22 --write
node sync-matches.js fk2 --ids "[m_fk2_04]" --write
```

설정: `sync-matches-config.js` (`SEASON_ID`, `league_seq`, `TEAM_CLUB_IDS`)

## CI

`.github/workflows/sync-matches.yml` — **매주 월요일 18:00 KST** 자동 실행  
(기록지 업로드가 늦으면 빈 기록은 skip하고 다음 주에 다시 시도)
