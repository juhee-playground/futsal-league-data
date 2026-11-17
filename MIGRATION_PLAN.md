# 마이그레이션 계획 (조사 보고)

> 상태: **적용 완료** (data + public)  
> 백업: `backups/20261117-185823/`  
> 검증: errors 0 / matches 121 / goals 731 유지 / score mismatch 경고 34건  
> Admin(`futsal-league-admin`)은 이번 범위 제외 (단, 영향은 하단에 기록)

---

## 1. 조사 요약

현재 `data/`는 이미 **masters + seasons 관계 모델**로 대부분 맞춰져 있다.  
이번 작업의 핵심은 “처음부터 구조 만들기”가 아니라 아래를 **정리·통일**하는 것이다.

1. 선수 영구 ID를 `pl_*`로 통일하고, 골의 `playerId`를 그 ID로 교체
2. 골에 고유 `id` 부여 (현재 731골 중 12개만 UUID 보유)
3. `players.json` 필드명 `uuid` → `id` (설계안)
4. `player_registrations`에서 중복 `divisionId` 제거 방향
5. `league.json` 중복 제거 (또는 `season.json` 기반 호환)
6. **프런트 조회 코드를 같은 변경에 맞춰 수정** (필수)

**2026-2027**은 `season.json` + `team_seasons.json`만 존재한다.  
등록·경기는 **임의 생성하지 않는다.**

---

## 2. As-Is 데이터 현황

### 디렉터리

```
data/masters/{divisions,teams,players}.json
data/seasons/2025-2026/{season,team_seasons,player_registrations}.json
data/seasons/2025-2026/division/{fk1,fk2,wk}/{league,matches}.json
data/seasons/2026-2027/{season,team_seasons}.json   # 스텁
```

### 규모 (2025-2026)

| 항목 | 수치 |
|------|------|
| 팀 마스터 | 21 (INACTIVE 3) |
| 선수 마스터 | 401 (`uuid`+`name`, position 315) |
| team_seasons | 19 |
| player_registrations | 401 (전부 `endDate: null`) |
| matches | fk1 45 / fk2 56 / wk 20 |
| goals | 731 (전부 `playerUuid` 있음, `playerId`=`p_*`) |
| goals with `id` | 12 (UUID 형식) |
| 자책골 | 3 (`teamId` ≠ 선수 소속팀 — 의미 유지) |

### ID 정합성 (이미 양호)

- `goals.playerId`(`p_*`) ↔ `registrations.legacyPlayerId` ↔ `goals.playerUuid`(`pl_*`): **불일치 0**
- registrations → players/teams: **누락 0**
- `league.json` ↔ `season.json` 디비전 항목: **내용 일치**

### 이미 존재하는 데이터 이슈 (마이그레이션에서 점수/골 수정 금지)

`score`와 `goals` 개수가 안 맞는 FINISHED 경기 **34건** (리포트만):

- 골 로그 부족 (예: `m_40` score 9-1 vs goals 8+1)
- 골 로그 없음 + score만 있음 (FK2 다수: `m_fk2_09`~ 등)
- 골이 score보다 많음 (예: `m_fk2_03` score 5-3 vs goals 6+2)

→ **공식 score / goals를 맞추기 위해 임의 수정하지 않음.** validation 리포트에만 남김.

### 시즌명 vs 마스터명

- `t_yongin`: 2025 `team_seasons.name`=`용인대흥FS`, 마스터=`용인지솔FS`  
  (프런트가 지금 마스터명을 쓰므로 과거 시즌 표시 버그 가능 — 아래 §4)

---

## 3. 프런트엔드 사용처 (`futsal-league-public`)

데이터 URL:

```
https://raw.githubusercontent.com/juhee-playground/futsal-league-data/main/data/...
```

진입점: `lib/leagueApi.ts` → `fetchLeagueData`

### 현재 필수 fetch (마스터 경로)

| URL | 용도 | 없으면 |
|-----|------|--------|
| `division/{div}/league.json` | 리그 메타 | masters 경로 전체 실패 → empty/legacy |
| `division/{div}/matches.json` | 경기·골 | 동일 |
| `masters/teams.json` | 팀 프로필 | 동일 |
| `masters/players.json` | 이름·포지션 (`uuid`) | 동일 |
| `team_seasons.json` | 시즌·디비전 참가 | 동일 |
| `player_registrations.json` | 로스터 | 동일 |
| `season.json` | **미사용** | — |

레거시 폴백: `division/*/teams.json`, `players.json` (현재 저장소에 없음).

### 조인 키 (깨지면 득점왕·선수페이지·타임라인 전부 깨짐)

```
ILeaguePlayer.id  = registration.legacyPlayerId   // p_goyang_7
goals.playerId    = p_*                           // 동일 키로 find
```

관련 파일:

- `lib/league-data/map-masters.ts` — 로스터 조립, **팀 이름은 마스터 `name` 사용**
- `lib/league-data/parse-masters.ts` — `uuid`, `divisionId`, `legacyPlayerId` **필수 검증**
- `lib/scorers.ts`, `lib/player-stats.ts`
- `app/.../scorers/*`, `matches/[id]/match-timeline.tsx`, `players/[id]/*`, `teams/[id]/*`

### 시즌 목록

`lib/seasons.ts`의 `LEAGUE_SEASONS`에 **2025-2026만** 등록.  
2026-2027을 UI에 쓰려면 여기에도 추가 필요 (데이터만으로는 선택 불가).

### Admin (범위 외, 영향만)

`futsal-league-admin`이 `goals.playerUuid`를 사용.  
골 필드 정리 시 Admin은 별도 후속 작업 필요.

---

## 4. 목표 스키마 vs 현재 / 프런트 충돌

| 변경 | 목표 | 현재 | 프런트 영향 |
|------|------|------|-------------|
| players PK | `id: pl_*` | `uuid: pl_*` | parse/map 수정 필수 |
| goals.playerId | `pl_*` | `p_*` (+ `playerUuid`) | 선수 id를 `pl_*`로 통일해야 조인 유지 |
| goals.id | 전원 보유 | 12/731 | 타입 확장 (조인에는 미사용) |
| registrations.divisionId | 제거 | 있음·필수 파싱 | 제거 시 join(`team_seasons`)로 대체 |
| registrations.legacyPlayerId | 제거 가능 | 필수 파싱 | 제거 시 선수 id=`playerUuid`/`id` |
| registrations.playerUuid | `playerId`로 통일? | `playerUuid` | 필드 rename 시 파서 수정 |
| league.json | 제거 | 필수 fetch | **season.json 조회로 교체 또는 생성 유지** |
| team 표시명 | `team_seasons.name` | 마스터 name만 사용 | **버그 수정 권장** (과거 시즌) |

---

## 5. 제안 마이그레이션 전략

### 원칙

- 백업 → dry-run → 리포트 → 적용
- 경기 수·골 수·score **불변**
- `pl_*` / `t_*` **재발급 금지**
- 2026-2027 등록·경기 **생성 금지**
- 불확실 매칭 **리포트만** (현재 골↔등록 매칭은 전원 확실)

### Phase A — 데이터 (`futsal-league-data`)

1. **backup** `data/` → `backups/YYYYMMDD-HHMMSS/`
2. **players.json**: `uuid` → `id` (값 동일). 다른 필드 유지
3. **matches goals**:
   - `playerId` ← 기존 `playerUuid` (`pl_*`)
   - `playerUuid` 필드 제거
   - 기존 `p_*`는 매핑 테이블/리포트로만 보존 (파일 `reports/legacy-player-id-map.json`)
   - 없는 `goals[].id`만 생성 (기존 id 유지, 멱등)
4. **player_registrations.json**:
   - `playerUuid` → `playerId` (값 `pl_*`)
   - `legacyPlayerId` 제거 (맵 파일로 백업)
   - `divisionId` 제거 (team_seasons로 유도)
   - 기존 이력 추측 생성 없음
5. **league.json**:
   - **권장 A (안전):** 파일 유지하되 “생성물”로 문서화. 스크립트가 `season.json`에서 재생성 가능
   - **권장 B (설계 충실):** 삭제 + 프런트가 `season.json`만 읽도록 변경  
   → 조사 결과 프런트가 강의존이므로 **B는 프런트와 동시 배포 필수**
6. **2026-2027**: 구조만 확인. `player_registrations`/`matches` 미생성
7. 문서 (`DATA_STRUCTURE.md`, `ADMIN_DATA_FORMAT.md`) 갱신

### Phase B — 프런트 (`futsal-league-public`) — **같은 배포 단위**

데이터만 먼저 푸시하면 **메인 사이트 즉시 깨짐**.

필수 수정:

| 파일 | 내용 |
|------|------|
| `lib/leagueApi.ts` | `league.json` 대신 `season.json`(+divisionId)로 메타 조립 **또는** league 유지 시 최소 변경 |
| `lib/league-data/masters-types.ts` | `id`, `playerId`, divisionId/legacy 제거 반영 |
| `lib/league-data/parse-masters.ts` | 새 스키마 파싱 |
| `lib/league-data/map-masters.ts` | 선수 `id = registration.playerId` (`pl_*`); 팀명=`team_seasons.name` 우선 |
| `types/global.d.ts` | `ILeagueGoalLog.id`, `isOwnGoal` 등 필요 시 |
| `lib/seasons.ts` | (선택) 2026-2027 시즌 엔트리 — 데이터 있는 디비전만 |

호환 전개 옵션:

- **동시 배포:** data main + public 배포를 한 번에
- **또는** 프런트가 한동안 `uuid`/`playerUuid`/`legacyPlayerId`/`divisionId`를 **둘 다** 받게 한 뒤 data 적용 → 이후 필드 제거

### Phase C — 검증 스크립트

`scripts/validation/*`에서:

- masters 중복/참조
- seasons·team_seasons
- registrations (기간 겹침, 등번호 중복 — 현 데이터는 단일 등록)
- matches (팀 참가, playerId∈players, goal id 중복, **score vs goals 불일치는 경고**)
- before/after 카운트: matches, goals, teams, players

실행 환경: `.tools`는 Node ESM + pnpm. 마이그레이션도 **Node(TS는 tsx 또는 plain JS)** 로 맞춤.  
(루트에 TS 툴체인 없음 → `scripts/`에 `.mjs` 또는 `.tools`에 tsx 추가 중 선택)

---

## 6. 변경 대상 파일 목록

### 데이터 레포 (쓰기)

| 경로 | 변경 |
|------|------|
| `data/masters/players.json` | `uuid`→`id` |
| `data/seasons/2025-2026/player_registrations.json` | 필드 정리 |
| `data/seasons/2025-2026/division/*/matches.json` | goals `playerId`/`id`/`playerUuid` |
| `data/seasons/*/division/*/league.json` | 삭제 또는 season 재생성 유지 |
| `scripts/migration/*` | 신규 |
| `scripts/validation/*` | 신규 |
| `backups/*` | 신규 (gitignore 권장) |
| `reports/*` | 마이그레이션·검증 리포트 |
| `DATA_STRUCTURE.md` / `ADMIN_DATA_FORMAT.md` / `TODO.md` | 문서 동기화 |

### 데이터 레포 (읽기만 / 유지)

| 경로 | 비고 |
|------|------|
| `masters/teams.json`, `divisions.json` | 구조 유지 |
| `team_seasons.json` (양 시즌) | 유지 (승강·이름 보존) |
| `season.json` | 유지·프런트 원천으로 승격 가능 |
| `2026-2027/*` | 임의 데이터 추가 없음 |

### 프런트 레포 (쓰기)

| 경로 | 변경 |
|------|------|
| `lib/leagueApi.ts` | fetch/조립 |
| `lib/league-data/*` | 파서·매퍼 |
| `types/global.d.ts` | 타입 |
| `lib/seasons.ts` | 2026-2027 노출 여부 |

득점왕/스탯 UI는 `player.id`↔`goal.playerId`만 맞으면 대부분 무수정.

---

## 7. 스크립트 구조 (제안)

```
scripts/
  migration/
    backup.mjs
    migrate-players.mjs
    migrate-matches.mjs
    migrate-registrations.mjs
    migrate-league-json.mjs   # regenerate or delete
    migrate-all.mjs           # --dry-run 지원
  validation/
    validate-masters.mjs
    validate-seasons.mjs
    validate-matches.mjs
    validate-all.mjs
```

`migrate-all.mjs --dry-run` → 변경 요약만 stdout + `reports/dry-run-*.json`  
재실행 시: 이미 `pl_*`인 `playerId`는 스킵, 있는 `goal.id`는 유지.

---

## 8. 확인 필요 결정 사항 (진행 전)

아래를 정해 주시면 그대로 구현합니다.

1. **`league.json`**
   - [ ] **B:** 삭제 + 프런트 `season.json` 조회로 전환 (설계 충실)
   - [ ] **A:** 유지하되 `season.json`에서 재생성하는 호환 레이어

2. **`player_registrations.divisionId`**
   - [ ] 제거 + 프런트에서 `teamId`→`team_seasons`로 division 필터
   - [ ] 당분간 유지 (중복이지만 프런트 변경 최소화)

3. **필드명**
   - [ ] registrations: `playerUuid` → `playerId`
   - [ ] players: `uuid` → `id`
   - (권장: 둘 다 한꺼번에)

4. **`legacyPlayerId` / URL**
   - 선수 페이지 URL이 현재 `/players/p_goyang_7` 형태  
   - `pl_*`로 바꾸면 **북마크·공유 링크 깨짐**
   - [ ] `pl_*`로 전환 (설계 충실, 구 URL 리다이렉트는 이번 제외 가능)
   - [ ] 내부 조인만 `pl_*`, 표시 id는 당분간 legacy 유지 (비권장·이중성)

5. **2026-2027 UI**
   - [ ] `LEAGUE_SEASONS`에 추가 (fk1/fk2만, 등록 없으면 empty 화면)
   - [ ] 데이터만 두고 UI는 나중에

6. **작업 범위**
   - [ ] data 레포만 먼저 (프런트 호환 레이어 유지하면서 단계적)
   - [ ] **data + public 동시** (권장)

---

## 9. 완료 조건 매핑

| # | 조건 | 계획상 대응 |
|---|------|-------------|
| 1 | 디렉터리 구조 | 유지 + 2026 registrations/matches는 있는 것만 |
| 2 | 새 스키마 | Phase A |
| 3 | 선수 ID `pl_*` | goals + players + registrations |
| 4 | 골 고유 ID | 누락분만 생성 |
| 5–7 | 참조·개수·순위 | validation + score 불일치는 경고만 |
| 8–9 | 시즌 표시 | 프런트 동시 수정 + 회귀 확인 |
| 10–11 | 오류·리포트 | `reports/` |

---

## 10. 다음 스텝

**이 계획 확인 전에는 마이그레이션을 실행하지 않습니다.**

확인 시 알려주실 것:

1. §8 결정 사항 (특히 league.json / URL id / 동시 배포)
2. “진행해” 한 마디

이후 순서: 백업 → dry-run 리포트 → 적용 → validate → 프런트 패치 → 카운트 비교 보고.
