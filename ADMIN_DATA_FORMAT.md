# Admin 전달용 데이터 형식 문서 (2025-2026 시즌)

이 문서는 admin 페이지 연동을 위해 `matches.json` 데이터 구조를 디비전별로 정리한 문서입니다.

## 1) 파일 경로

- FK1: `data/seasons/2025-2026/division/fk1/matches.json`
- FK2: `data/seasons/2025-2026/division/fk2/matches.json`
- WK: `data/seasons/2025-2026/division/wk/matches.json`

모든 파일은 **경기 객체 배열(Array)** 형식입니다.

## 2) 공통 경기 객체 스키마

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
  - `playerId`: 선수 ID (`p_*`)
  - `playerUuid`: 선수 고유 ID (`pl_0001` 형식)
  - `teamId`: 득점으로 인정되는 팀 ID
  - `half`: 전반/후반 (`1` 또는 `2`)
  - `minute`: 해당 하프 기준 분 (1~20)
  - `isOwnGoal`: 자책골 여부

## 선수 데이터(`players.json`) 필드

각 디비전의 `players.json`에는 선수 고유 식별용 `uuid`가 포함됩니다.

```json
{
  "id": "p_goyang_7",
  "uuid": "pl_0123",
  "name": "홍길동",
  "teamId": "t_goyang",
  "number": 7,
  "position": "ALA"
}
```

### 상태별 데이터 규칙

- `status = SCHEDULED`
  - 일반적으로 `score = { home: 0, away: 0 }`
  - `goals = []`
- `status = FINISHED`
  - `score`와 `goals`가 채워짐

## 3) 디비전별 차이

구조 자체는 동일하고, 주로 `id` 패턴과 팀 ID 세트가 다릅니다.

### FK1

- 파일: `data/seasons/2025-2026/division/fk1/matches.json`
- 경기 ID 패턴: `m_숫자` (예: `m_41`)
- 현재 상태: 총 45경기 (`SCHEDULED` 3, `FINISHED` 42)

### FK2

- 파일: `data/seasons/2025-2026/division/fk2/matches.json`
- 경기 ID 패턴: `m_fk2_숫자` (예: `m_fk2_01`)
- 현재 상태: 총 56경기 (`FINISHED` 56)

### WK

- 파일: `data/seasons/2025-2026/division/wk/matches.json`
- 경기 ID 패턴: `m_w_숫자` (예: `m_w_01`)
- 현재 상태: 총 20경기 (`FINISHED` 20)

## 4) UUID 적용 현황

- 선수 마스터: `players.json`의 모든 선수에 `uuid` 저장
- 골 로그: `matches.json`의 모든 `goals[]`에 `playerUuid` 저장
- 레거시 호환: 기존 `playerId`는 유지

## 5) 이적(선수 소속 변경) 관련 참고

현재 `playerId`는 팀 정보를 포함하는 형태(예: `p_goyang_7`)라서, 이적 데이터 관리에는 불리합니다.
현재는 `uuid`/`playerUuid`를 함께 저장해 이 문제를 보완합니다.

### 권장 구조 방향

- 선수 고유 ID를 팀과 분리:
  - 예: `uuid: "pl_0123"` (영구 불변)
- 소속 히스토리 테이블(또는 파일) 추가:
  - 예: `playerRegistrations[] = { playerUuid, teamId, startDate, endDate, shirtNumber }`
- 경기 `goals`에는 최소 `playerUuid`를 저장:
  - 필요 시 `playerId`(레거시) 병행 저장 후 점진 제거

### 최소 변경(점진적)안

1. 기존 `goals.playerId` 유지
2. `goals.playerUuid` 필드 추가
3. 별도 소속 히스토리 파일 추가
4. admin 페이지는 우선 `playerUuid` 기준으로 선수 조회, 날짜 기준으로 당시 소속 계산

위 방식이면 과거 데이터와 호환성을 유지하면서 이적 기능을 확장할 수 있습니다.
