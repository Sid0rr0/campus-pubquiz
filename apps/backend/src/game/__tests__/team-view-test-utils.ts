import { SOCKET_EVENTS, type OwnTeamView } from '@campus-pubquiz/types';
import { asSocket } from '@/game/__tests__/test-utils';
import type {
  JoinedTeam,
  RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

/** Every team view the server addressed to this team's socket, in emit order. */
export function teamViewsTo(
  game: RealStoreGateway,
  team: Pick<JoinedTeam, 'socket'>,
): OwnTeamView[] {
  return game
    .roomEmits()
    .filter(
      (emit) =>
        emit.rooms.includes(team.socket.id) &&
        emit.event === SOCKET_EVENTS.TEAM_VIEW,
    )
    .map((emit) => emit.payload as OwnTeamView);
}

/**
 * The live-equals-resync property: the last team view this team's connected
 * phone received equals the team view a fresh rejoin of the team gets in its
 * join reply right now. Call it after any change to the team. The rejoin takes
 * the seat over from `team.socket`, so make it the last step of a test.
 */
export async function expectLiveEqualsResync(
  game: RealStoreGateway,
  team: JoinedTeam,
): Promise<void> {
  const received = teamViewsTo(game, team);
  expect(received.length).toBeGreaterThan(0);
  const phone = await game.connectPlayer();
  await game.gateway.handleJoinPlayers(asSocket(phone), {
    teamName: 'unused: the token names the team',
    teamToken: team.teamToken,
    joinCode: game.joinCode,
    previousSocketId: team.socket.id,
  });
  const accepted = phone.emit.mock.calls.find(
    ([event]) => event === SOCKET_EVENTS.JOIN_ACCEPTED,
  ) as [string, { teamView: OwnTeamView }] | undefined;
  expect(accepted?.[1].teamView).toEqual(received[received.length - 1]);
}
