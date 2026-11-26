/**
 * 경기 기록 동기화 설정
 * futsal.or.kr gameLeagueRecord URL: ?club1_id=X&club2_id=Y&league_seq=N&league_type=T&game_number=G
 */

export const SEASON_ID = "2026-2027";

// 리그별 league_seq, league_type (futsal.or.kr 대회 상세에서 확인)
export const LEAGUE_CONFIG = {
  fk1: { league_seq: 116, league_type: 10 },
  fk2: { league_seq: 117, league_type: 10 },
  wk: { league_seq: null, league_type: null } // 26-27 WK 미설정
};

// teamId → futsal.or.kr club_id 매핑
export const TEAM_CLUB_IDS = {
  // FK1 (2026-2027)
  t_gangwon: "gwFSclub",
  t_goyang: "GoyangBulls",
  t_nowon: "fsseoul",
  t_eunpyeong: "eunpyeongfs",
  t_yongin: "yongintmt",
  t_hwaseong: "hwaseongFS",
  // FK2 (2026-2027)
  t_gumi: "yesgumi",
  t_daegu: "daeguFS",
  t_gunsan: "gunsanfs",
  t_jecheon: "didfc",
  t_cheongju: "CHFS",
  t_incheon: "IncheonFS",
  t_incheon_zd: "IncheonZD"
};

/**
 * matchId에서 game_number 추출
 * m_01, m_45 → 1, 45
 * m_fk2_02 → 2
 * m_w_13 → 13
 */
export function getGameNumber(matchId) {
  const m = matchId.match(/m_(?:fk2_|w_)?(\d+)$/);
  return m ? parseInt(m[1], 10) : null;
}
