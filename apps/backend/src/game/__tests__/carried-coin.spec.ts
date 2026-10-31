import {
  CARRIED_COINS,
  SOCKET_EVENTS,
  SOCKET_ROOMS,
} from '@campus-pubquiz/types';
import { Answer } from '@/db/entities/answer.entity';
import { GameSession } from '@/db/entities/game-session.entity';
import { League } from '@/db/entities/league.entity';
import { LeagueSession } from '@/db/entities/league-session.entity';
import { Question } from '@/db/entities/question.entity';
import { Quiz } from '@/db/entities/quiz.entity';
import { Round } from '@/db/entities/round.entity';
import { RoundRating } from '@/db/entities/round-rating.entity';
import { Team } from '@/db/entities/team.entity';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  TWO_ROUND_QUIZ,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

describe('Carried coin', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;
  let league: League;
  let joinCounter = 0;
  /** The socket each team last joined from, named as the previous one on a rejoin. */
  const lastDevice = new Map<number, string>();

  beforeEach(async () => {
    joinCounter = 0;
    lastDevice.clear();
    game = await harness.createGateway({
      rounds: TWO_ROUND_QUIZ,
      settings: { powerUpsEnabled: false },
    });
    const em = game.orm.em.fork();
    league = em.create(League, {
      name: 'Autumn',
      startsOn: '2019-09-01',
      endsOn: '2999-12-31',
    });
    await em.flush();
  });

  async function putCurrentSessionInLeague(): Promise<void> {
    const em = game.orm.em.fork();
    em.create(LeagueSession, {
      league: em.getReference(League, league.id),
      gameSession: em.getReference(GameSession, game.gameSessionId),
    });
    await em.flush();
  }

  async function seedTeam(name: string): Promise<Team> {
    const em = game.orm.em.fork();
    const team = em.create(Team, {
      name,
      token: `${name}-token`,
      code: `${name.toUpperCase()}1`,
    });
    await em.flush();
    return team;
  }

  /**
   * An ended night of a throwaway quiz with two rounds in which `team`
   * answered, in the league or not, with ratings for the given round indexes.
   */
  async function playNight(
    team: Team,
    options: { inLeague: boolean; ratedRounds: number[]; answered?: boolean },
  ): Promise<void> {
    const em = game.orm.em.fork();
    const quiz = em.create(Quiz, { title: 'Past quiz' });
    const rounds = [0, 1].map((index) =>
      em.create(Round, { quiz, title: `Round ${index}`, orderIndex: index }),
    );
    const question = em.create(Question, {
      round: rounds[0],
      orderIndex: 0,
      type: 'free_text',
      prompt: 'Q',
      answer: 'a',
      points: 1,
    });
    joinCounter += 1;
    const session = em.create(GameSession, {
      quiz,
      joinCode: `PAST${joinCounter}`,
      status: 'ended',
    });
    if (options.answered !== false) {
      em.create(Answer, {
        gameSession: session,
        question,
        team: em.getReference(Team, team.id),
        value: 'a',
      });
    }
    if (options.inLeague) {
      em.create(LeagueSession, {
        league: em.getReference(League, league.id),
        gameSession: session,
      });
    }
    for (const index of options.ratedRounds) {
      em.create(RoundRating, {
        gameSession: session,
        round: rounds[index],
        team: em.getReference(Team, team.id),
        stars: 4,
      });
    }
    await em.flush();
  }

  /** Joins `team` by its token and returns the coins its JOIN_ACCEPTED carried. */
  async function joinReplyCoins(
    team: Team,
    on: RealStoreGateway = game,
  ): Promise<number> {
    const device = await on.connectPlayer();
    await on.gateway.handleJoinPlayers(asSocket(device), {
      teamName: team.name,
      teamToken: team.token,
      previousSocketId: lastDevice.get(team.id),
      joinCode: on.joinCode,
    });
    lastDevice.set(team.id, device.id);
    const [, payload] = (
      device.emit.mock.calls as [string, { coins: number }][]
    ).find(([event]) => event === SOCKET_EVENTS.JOIN_ACCEPTED)!;
    return payload.coins;
  }

  function adminCoins(on: RealStoreGateway = game): Record<string, number> {
    return Object.fromEntries(
      on.gameState
        .getView(on.joinCode, SOCKET_ROOMS.ADMIN)
        .teams.map((team) => [team.teamName, team.coins]),
    );
  }

  it('brings a coin from the last league night the team played, skipping the one it missed and the one outside the league', async () => {
    await putCurrentSessionInLeague();
    const team = await seedTeam('Quizzards');
    await playNight(team, { inLeague: true, ratedRounds: [0, 1] }); // A
    await playNight(team, {
      inLeague: true,
      ratedRounds: [],
      answered: false,
    }); // B: missed
    await playNight(team, { inLeague: false, ratedRounds: [] }); // N: no league
    await joinReplyCoins(team);

    await game.act('START_QUIZ');

    expect(adminCoins()).toEqual({ Quizzards: CARRIED_COINS });
  });

  it('brings no coin when the last league night was not rated in every round', async () => {
    await putCurrentSessionInLeague();
    const team = await seedTeam('Quizzards');
    await playNight(team, { inLeague: true, ratedRounds: [0, 1] });
    await playNight(team, { inLeague: true, ratedRounds: [1] });
    await joinReplyCoins(team);

    await game.act('START_QUIZ');

    expect(adminCoins()).toEqual({ Quizzards: 0 });
  });

  it('brings no coin when the session is in no league', async () => {
    const team = await seedTeam('Quizzards');
    await playNight(team, { inLeague: true, ratedRounds: [0, 1] });
    await joinReplyCoins(team);

    await game.act('START_QUIZ');

    expect(adminCoins()).toEqual({ Quizzards: 0 });
  });

  it('gives a team that joins after the start its coin, and keeps it when the league is removed, on a rejoin and after a restart', async () => {
    await putCurrentSessionInLeague();
    const team = await seedTeam('Latecomers');
    await playNight(team, { inLeague: true, ratedRounds: [0, 1] });
    await game.act('START_QUIZ');
    expect(await joinReplyCoins(team)).toBe(CARRIED_COINS);

    const em = game.orm.em.fork();
    await em.nativeDelete(LeagueSession, {
      gameSession: game.gameSessionId,
    });

    expect(await joinReplyCoins(team)).toBe(CARRIED_COINS);
    expect(adminCoins()).toEqual({ Latecomers: CARRIED_COINS });
    const restarted = await game.restart();
    expect(await joinReplyCoins(team, restarted)).toBe(CARRIED_COINS);
  });

  it('shows the coin to its holder only when power-ups are off', async () => {
    await putCurrentSessionInLeague();
    const holder = await seedTeam('Holder');
    const other = await seedTeam('Other');
    await playNight(holder, { inLeague: true, ratedRounds: [0, 1] });
    await playNight(other, { inLeague: true, ratedRounds: [0] });
    await joinReplyCoins(holder);
    await joinReplyCoins(other);

    await game.act('START_QUIZ');

    expect(adminCoins()).toEqual({ Holder: CARRIED_COINS, Other: 0 });
  });
});
