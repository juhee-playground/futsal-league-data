## 📊 데이터 구조

본 프로젝트의 순위표(Standings)와 득점 순위(Scorers)는 `matches.json`의 `goals` 배열을 바탕으로 골 결과에서 계산하여 사용합니다.

## 🔄 경기 기록 크롤링

`matches.json`과 `crawl-config.js` 설정을 기반으로 futsal.or.kr에서 스코어·골 기록을 자동 수집합니다.

```bash
node test-crawl.js fk2                    # 날짜 지났는데 미입력인 경기만
node test-crawl.js wk --date 2026-02-22   # 특정 날짜 경기
node test-crawl.js fk1 --ids "[m_28,m_29,m_30]"   # 번호(배열)로 지정
node test-crawl.js fk1 --ids "[m_34,m_36]" --write   # 크롤 후 matches.json에 반영
```

**설정 파일** `crawl-config.js`:
- `LEAGUE_CONFIG`: 리그별 `league_seq`, `league_type` (사이트 대회 페이지에서 확인)
- `TEAM_CLUB_IDS`: teamId → 사이트 `club_id` 매핑

FK1은 `league_seq`/`league_type`과 `TEAM_CLUB_IDS`를 채워야 크롤이 가능합니다. 실제 경기 기록 URL에서 `club1_id`, `club2_id`, `league_seq`, `game_number` 등을 확인해 추가하면 됩니다.
