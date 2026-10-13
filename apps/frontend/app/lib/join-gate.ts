interface JoinGateInput {
  teamName: string | null;
  activeJoinCode: string | null;
  hasView: boolean;
  connectionError: string | null;
  hasTeam: boolean;
}

/**
 * Whether a phone should show the join form rather than "Connecting…" or the
 * game. teamName (local state, cleared by "log out") is the source of truth,
 * not the team (socket state, which is never reset once a join is accepted).
 * A stored team name alone doesn't mean a reconnect is possible — a closed
 * session keeps the name but clears its join code (see clearStoredSession), so
 * without a join code and without a view there is nothing to connect to and
 * the phone would hang on "Connecting…" forever. Once a view has arrived it
 * proves a connection did happen, even if the join code was cleared since.
 */
export function needsJoinForm({
  teamName,
  activeJoinCode,
  hasView,
  connectionError,
  hasTeam,
}: JoinGateInput): boolean {
  const canReachView = Boolean(activeJoinCode) || hasView;
  return !teamName || !canReachView || Boolean(connectionError && !hasTeam);
}
