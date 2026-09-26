/** One row per **ended** game session, for the admin/moderator stats history view. */
export interface PlayedSessionStats {
  gameSessionId: number;
  joinCode: string;
  quizTitle: string;
  playedAt: string; // game_sessions.created_at, ISO
  teamCount: number; // game_session_teams rows for this session
  maxPoints: number; // sum(questions.points) over the session's quiz
  // Leaderboard winner (ranked by total incl. bonus, same order as
  // AnswerService.computeLeaderboard: total desc, team name asc) — null when
  // no teams joined.
  winnerTeamName: string | null;
  winnerAnswerPoints: number | null; // that team's answer points only, bonus excluded
}
