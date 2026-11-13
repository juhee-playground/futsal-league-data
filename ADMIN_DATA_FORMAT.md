# Admin 전달용 데이터 형식 문서

팀·선수는 마스터로 두고, 시즌 소속(승격·강등·이적)은 관계 파일로 관리합니다.

## 1) 디렉터리 구조

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
      league.json
      matches.json
```

## 2) 마스터

### `masters/divisions.json`

```json
{
  "id": "fk1",
  "name": "FK 1부 리그",
  "leagueId": "division-1"
}
```

### `masters/teams.json`

팀 고유 정보만 저장합니다. **디비전 필드는 두지 않습니다.**

```json
{
  "id": "t_goyang",
  "name": "고양불스풋살클럽",
  "color": "#e7b573",
  "darkColor": "#fbbf24",
  "logo": "team_goyang.jpg",
  "address": "string",
  "location": "string",
  "homepage": "string"
}
```

- `homepage`는 선택 필드입니다.

### `masters/players.json`

선수 고유 정보만 저장합니다. **팀/등번호는 두지 않습니다.**

```json
{
  "uuid": "pl_0123",
  "name": "홍길동",
  "position": "ALA"
}
```

- `uuid`: 영구 불변 선수 ID (`pl_####`)
- `position`: 선택 필드 (`GOLEIRO` | `FIXO` | `ALA` | `PIVO`)

## 3) 시즌 관계

### `seasons/{seasonId}/season.json`

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

### `team_seasons.json` (승격·강등)

```json
{
  "id": "ts_2025-2026_goyang",
  "teamId": "t_goyang",
  "seasonId": "2025-2026",
  "divisionId": "fk1",
  "status": "ACTIVE"
}
```

- 승격/강등: 다음 시즌에 다른 `divisionId`로 row를 추가합니다.
- 예: `2025-2026` FK1 → `2026-2027` FK2 = 강등

### `player_registrations.json` (이적)

```json
{
  "id": "pr_pl_0123_2025-2026_goyang",
  "playerUuid": "pl_0123",
  "teamId": "t_goyang",
  "seasonId": "2025-2026",
  "divisionId": "fk1",
  "shirtNumber": 7,
  "startDate": "2025-11-15",
  "endDate": null,
  "legacyPlayerId": "p_goyang_7"
}
```

| 필드 | 설명 |
|------|------|
| `playerUuid` | 선수 마스터 참조 |
| `teamId` | 등록 시점 소속 팀 |
| `shirtNumber` | 해당 소속 기간 등번호 |
| `startDate` / `endDate` | 소속 기간 (`endDate: null` = 현재 소속) |
| `legacyPlayerId` | 구 `playerId` (`p_*`) 호환용 |

이적 처리:

1. 기존 row의 `endDate`를 이적일로 설정
2. 새 `teamId`로 row 추가 (`startDate` = 이적일, `endDate` = null)

특정 날짜 소속 조회:

```
startDate <= date AND (endDate == null OR date <= endDate)
```

## 4) 경기 데이터 (`matches.json`)

경로:

- FK1: `data/seasons/2025-2026/division/fk1/matches.json`
- FK2: `data/seasons/2025-2026/division/fk2/matches.json`
- WK: `data/seasons/2025-2026/division/wk/matches.json`

모든 파일은 **경기 객체 배열(Array)** 형식입니다.

```json
{
  "id": "string",
  "round": 1,
  "date": "YYYY-MM-DD",
  "time": "HH:mm",
  "place": "string",
  "homeTeamId": "t_*",
  "awayTeamId": "t_*",
  "status": "SCHEDULED | FINISHED",
  "youtube_url": "string",
  "goals": [
    {
      "playerId": "p_*",
      "playerUuid": "pl_0001",
      "teamId": "t_*",
      "half": 1,
      "minute": 1,
      "isOwnGoal": false
    }
  ],
  "score": {
    "home": 0,
    "away": 0
  }
}
```

### 필드 설명

- `id`: 경기 ID (디비전마다 접두어 규칙 상이)
- `round`: 라운드 번호
- `date`: 경기일 (`YYYY-MM-DD`)
- `time`: 경기시각 (`HH:mm`)
- `place`: 경기장명
- `homeTeamId`, `awayTeamId`: 팀 ID (`t_*`)
- `status`: 경기 상태 (`SCHEDULED`, `FINISHED`)
- `youtube_url`: 중계/다시보기 URL (없으면 `""`)
- `score.home`, `score.away`: 팀별 득점
- `goals[]`: 개별 득점 로그
  - `playerUuid`: 선수 고유 ID (권장 조회 키)
  - `playerId`: 레거시 ID (`p_*`, `legacyPlayerId`와 매칭)
  - `teamId`: 득점으로 인정되는 팀 ID
  - `half`: 전반/후반 (`1` 또는 `2`)
  - `minute`: 해당 하프 기준 분 (1~20)
  - `isOwnGoal`: 자책골 여부

### 상태별 규칙

- `status = SCHEDULED`
  - 일반적으로 `score = { home: 0, away: 0 }`
  - `goals = []`
- `status = FINISHED`
  - `score`와 `goals`가 채워짐

## 5) 디비전별 경기 ID 패턴

구조는 동일하고, `id` 패턴과 팀 ID 세트가 다릅니다.

### FK1

- 파일: `data/seasons/2025-2026/division/fk1/matches.json`
- 경기 ID 패턴: `m_숫자` (예: `m_41`)

### FK2

- 파일: `data/seasons/2025-2026/division/fk2/matches.json`
- 경기 ID 패턴: `m_fk2_숫자` (예: `m_fk2_01`)

### WK

- 파일: `data/seasons/2025-2026/division/wk/matches.json`
- 경기 ID 패턴: `m_w_숫자` (예: `m_w_01`)

## 6) Admin 조회 가이드

| 질문 | 데이터 소스 |
|------|-------------|
| 이번 시즌 FK1 팀 목록 | `team_seasons` where `seasonId` + `divisionId=fk1` → `masters/teams` |
| 팀 상세(로고/주소) | `masters/teams` |
| 현재 선수 명단 | `player_registrations` where `endDate=null` (+ 팀/디비전 필터) |
| 특정 경기일 당시 소속 | `player_registrations`를 날짜로 조회 |
| 선수 이름/포지션 | `masters/players` (`uuid`) |
| 골 → 선수 | `goals.playerUuid` (레거시는 `playerId` ↔ `legacyPlayerId`) |

## 7) 마이그레이션 메모 (2025-2026)

기존 `division/*/teams.json`, `division/*/players.json` 은 아래처럼 분리했습니다.

1. 팀 스냅샷 → `masters/teams.json` + `team_seasons.json`
2. 선수 스냅샷 → `masters/players.json` + `player_registrations.json`
3. `matches.json`의 `playerUuid` / 레거시 `playerId`는 유지
