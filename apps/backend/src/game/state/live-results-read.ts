import { Logger } from '@nestjs/common';
import type { SessionState } from '@campus-pubquiz/types';
import { StandingsService } from '@/standings/standings.service';

/**
 * The live results read: the session's live results (leaderboard, verdict
 * tallies, fun fact data) are the figures derived from its stored answers and
 * bonus awards. Given a session, it returns that session with every live
 * result replaced by a fresh read from the Standings module. It stores
 * nothing; the caller does.
 *
 * The reads run in parallel, each on its own. A read that fails is logged with
 * the live result's name and the session's join code, and that live result keeps the
 * value the given session already holds, so this never throws because a read
 * failed.
 *
 * Adding a live result means adding its field to the session record and its
 * read here, nothing else. The league top is deliberately not a live result:
 * a league table counts only ended sessions, so this session's scoring can't
 * change it (the league change module owns it).
 */
export class LiveResultsRead {
  private readonly logger = new Logger('LiveResultsRead');

  constructor(private readonly standingsService: StandingsService) {}

  async read(session: SessionState): Promise<SessionState> {
    const { gameSessionId } = session.seededGame;
    const [leaderboard, verdictTallies, funFactData] = await Promise.all([
      this.readOrKeep(
        session,
        'Standings',
        () => this.standingsService.leaderboard(gameSessionId),
        session.leaderboard,
      ),
      this.readOrKeep(
        session,
        'Verdict tally',
        () => this.standingsService.verdictTallies(gameSessionId),
        session.verdictTallies,
      ),
      this.readOrKeep(
        session,
        'Fun fact data',
        () => this.standingsService.funFactData(gameSessionId),
        session.funFactData,
      ),
    ]);
    return { ...session, leaderboard, verdictTallies, funFactData };
  }

  private async readOrKeep<R>(
    session: SessionState,
    liveResult: string,
    read: () => Promise<R>,
    kept: R,
  ): Promise<R> {
    try {
      return await read();
    } catch (error) {
      this.logger.error(
        `${liveResult} read failed for session ${session.seededGame.joinCode}; keeping the earlier value until the next write`,
        error instanceof Error ? error.stack : String(error),
      );
      return kept;
    }
  }
}
