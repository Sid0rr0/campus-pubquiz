#!/usr/bin/env node
// Simulates N teams joining a running game session on /play and auto-answering
// whatever question is currently open, for manually exercising multi-team
// behavior (leaderboard ties/animation, reconnects, race conditions) without
// opening a pile of browser tabs by hand.
//
// Teams are real persistent entities (unique by name), same as /play — so
// each simulated team's token is cached in .simulated-teams.json next to this
// script and replayed on the next run, letting reruns reuse the same names
// (e.g. "Sim Team 1") as the same team instead of hitting "already
// registered". Delete that file to start over with fresh teams.
//
// Usage:
//   node scripts/simulate-players.mjs --code ABCD12 [--teams 8] [--prefix Team]
//     [--url http://localhost:3000] [--min-delay 500] [--max-delay 4000]
//
// Stop with Ctrl+C — every simulated team disconnects cleanly.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { io } from 'socket.io-client';

const TOKENS_FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '.simulated-teams.json',
);

function loadTokens() {
  try {
    return JSON.parse(readFileSync(TOKENS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveTokens(tokens) {
  writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2));
}

const SOCKET_EVENTS = {
  STATE_SYNC: 'game:state_sync',
  STATE_UPDATED: 'game:state_updated',
  JOIN_ACCEPTED: 'game:join_accepted',
  SESSION_CLOSED: 'game:session_closed',
  TEAM_KICKED: 'game:team_kicked',
  SUBMIT_ANSWER: 'game:submit_answer',
  JOIN_PLAYERS: 'game:join_players',
};

const FREE_TEXT_ANSWERS = [
  'The Eiffel Tower',
  'Mitochondria',
  '42',
  'Julius Caesar',
  'Photosynthesis',
  'Bermuda Triangle',
  'not sure, going with vibes',
];

function parseArgs(argv) {
  const args = {
    teams: 4,
    prefix: 'Sim Team',
    url: 'http://localhost:3000',
    minDelay: 1000,
    maxDelay: 4000,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === '--code') args.code = value;
    else if (flag === '--teams') args.teams = Number(value);
    else if (flag === '--prefix') args.prefix = value;
    else if (flag === '--url') args.url = value;
    else if (flag === '--min-delay') args.minDelay = Number(value);
    else if (flag === '--max-delay') args.maxDelay = Number(value);
    else continue;
    i += 1;
  }
  return args;
}

function randomAnswerFor(question) {
  const { type, options = [], matchTargets = [] } = question;
  switch (type) {
    case 'multiple_choice':
      return options[Math.floor(Math.random() * options.length)] ?? '';
    case 'sort':
      return [...options].sort(() => Math.random() - 0.5).join('|');
    case 'match': {
      const shuffledTargets = [...matchTargets].sort(() => Math.random() - 0.5);
      return shuffledTargets.join('|');
    }
    case 'closest_guess':
      return String(Math.floor(Math.random() * 1000));
    default:
      return FREE_TEXT_ANSWERS[
        Math.floor(Math.random() * FREE_TEXT_ANSWERS.length)
      ];
  }
}

function randomDelay(min, max) {
  return min + Math.random() * (max - min);
}

function startTeam({ url, code, teamName, minDelay, maxDelay, tokens }) {
  const log = (message) => console.log(`[${teamName}] ${message}`);
  const socket = io(url, {
    query: { role: 'players', code },
    withCredentials: true,
  });

  let teamId = null;
  const answeredQuestionIds = new Set();

  socket.on('connect', () => {
    socket.emit(SOCKET_EVENTS.JOIN_PLAYERS, {
      teamName,
      joinCode: code,
      teamToken: tokens[teamName],
    });
  });

  socket.on(SOCKET_EVENTS.JOIN_ACCEPTED, (payload) => {
    teamId = payload.teamId;
    for (const answer of payload.answers ?? []) {
      answeredQuestionIds.add(answer.questionId);
    }
    tokens[teamName] = payload.teamToken;
    saveTokens(tokens);
    log(`joined (teamId=${teamId})`);
  });

  socket.on('exception', (error) => {
    log(`server rejected: ${error?.message ?? JSON.stringify(error)}`);
  });

  socket.on('connect_error', (error) => {
    log(`connect_error: ${error.message}`);
  });

  const maybeAnswer = (snapshot) => {
    const question = snapshot.currentQuestion;
    if (!question || teamId === null || answeredQuestionIds.has(question.id)) {
      return;
    }
    // Mirrors play/page.tsx's isAnswerable: a kahootMode question opened
    // right after the previous reveal sits behind the leaderboard until the
    // admin TOGGLE_LEADERBOARDs it away, and the server now rejects
    // SUBMIT_ANSWER for it until then too. Skip for now — this fires again
    // on the STATE_UPDATED that toggling produces.
    if (
      snapshot.isCurrentRoundKahoot &&
      snapshot.progress.isLeaderboardVisible
    ) {
      return;
    }
    answeredQuestionIds.add(question.id);
    const value = randomAnswerFor(question);
    setTimeout(
      () => {
        socket.emit(SOCKET_EVENTS.SUBMIT_ANSWER, {
          questionId: question.id,
          teamId,
          value,
        });
        log(`answered question ${question.id}: "${value}"`);
      },
      randomDelay(minDelay, maxDelay),
    );
  };

  socket.on(SOCKET_EVENTS.STATE_SYNC, maybeAnswer);
  socket.on(SOCKET_EVENTS.STATE_UPDATED, maybeAnswer);

  socket.on(SOCKET_EVENTS.TEAM_KICKED, (payload) => {
    if (payload.teamId === teamId) {
      log('kicked by admin');
      socket.disconnect();
    }
  });

  socket.on(SOCKET_EVENTS.SESSION_CLOSED, () => {
    log('session closed');
    socket.disconnect();
  });

  return socket;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.code) {
    console.error(
      'Usage: node scripts/simulate-players.mjs --code <joinCode> [--teams 8] [--prefix "Team"] [--url http://localhost:3000]',
    );
    process.exit(1);
  }

  console.log(
    `Simulating ${args.teams} team(s) joining session ${args.code} at ${args.url}`,
  );
  const tokens = loadTokens();
  const sockets = Array.from({ length: args.teams }, (_, index) =>
    startTeam({
      url: args.url,
      code: args.code,
      teamName: `${args.prefix} ${index + 1}`,
      minDelay: args.minDelay,
      maxDelay: args.maxDelay,
      tokens,
    }),
  );

  process.on('SIGINT', () => {
    console.log('\nDisconnecting simulated teams...');
    for (const socket of sockets) {
      socket.disconnect();
    }
    process.exit(0);
  });
}

main();
