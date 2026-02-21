/**
 * 크롤링용 설정
 * futsal.or.kr gameLeagueRecord URL: ?club1_id=X&club2_id=Y&league_seq=N&league_type=T&game_number=G
 */

// 리그별 league_seq, league_type (futsal.or.kr 대회 상세에서 확인)
export const LEAGUE_CONFIG = {
  fk1: { league_seq: 108, league_type: 10 },
  fk2: { league_seq: 109, league_type: 10 },
  wk: { league_seq: 110, league_type: 11 }
};

// teamId → futsal.or.kr club_id 매핑
export const TEAM_CLUB_IDS = {
  // FK1
  t_gyeonggi: "LBFS",
  t_nowon: "fsseoul",
  t_eunpyeong: "eunpyeongfs",
  t_gangwon: "gwFSclub",
  t_jeonju: "jeonjumag",
  t_goyang: "GoyangBulls",
  // FK2
  t_gumi: "yesgumi",
  t_daegu: "daeguFS",
  t_namdong: "agonFutsal",
  t_gunsan: "gunsanfs",
  t_yongin: "yongintmt",
  t_jecheon: "jecheonFutsal",
  t_cheongju: "CHFS",
  t_hwaseong: "hwaseongFS",
  // WFK
  t_apro: "APRO_ZD",
  t_yongin_wfs: "tmSportsWomen",
  t_goyang_wfs: "GoyangBullsWomen",
  t_hwaseong_wfs: "hwaseong_WFS",
  t_namdong_wfs: "IncheonFSwomen"
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
