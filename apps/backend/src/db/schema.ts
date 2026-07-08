import { relations } from 'drizzle-orm';
import { boolean, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const quizzes = pgTable('quizzes', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const rounds = pgTable(
  'rounds',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    quizId: uuid('quiz_id')
      .notNull()
      .references(() => quizzes.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    orderIndex: integer('order_index').notNull(),
    breakAfter: boolean('break_after').notNull().default(false),
  },
  (table) => [uniqueIndex('rounds_quiz_id_order_index_idx').on(table.quizId, table.orderIndex)],
);

export const questions = pgTable(
  'questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roundId: uuid('round_id')
      .notNull()
      .references(() => rounds.id, { onDelete: 'cascade' }),
    orderIndex: integer('order_index').notNull(),
    type: text('type').notNull(),
    prompt: text('prompt').notNull(),
    payload: jsonb('payload').notNull().default({}),
    points: integer('points').notNull().default(1),
  },
  (table) => [uniqueIndex('questions_round_id_order_index_idx').on(table.roundId, table.orderIndex)],
);

export const gameSessions = pgTable('game_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  quizId: uuid('quiz_id')
    .notNull()
    .references(() => quizzes.id, { onDelete: 'cascade' }),
  joinCode: text('join_code').notNull().unique(),
  status: text('status').notNull().default('lobby'),
  currentRoundIndex: integer('current_round_index').notNull().default(0),
  currentQuestionIndex: integer('current_question_index').notNull().default(0),
  isLeaderboardVisible: boolean('is_leaderboard_visible').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const teams = pgTable(
  'teams',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameSessionId: uuid('game_session_id')
      .notNull()
      .references(() => gameSessions.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('teams_game_session_id_name_idx').on(table.gameSessionId, table.name)],
);

export const answers = pgTable(
  'answers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameSessionId: uuid('game_session_id')
      .notNull()
      .references(() => gameSessions.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    value: text('value').notNull(),
    pointsAwarded: integer('points_awarded'),
    gradedAt: timestamp('graded_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('answers_session_question_team_idx').on(table.gameSessionId, table.questionId, table.teamId),
  ],
);

export const quizzesRelations = relations(quizzes, ({ many }) => ({
  rounds: many(rounds),
  gameSessions: many(gameSessions),
}));

export const roundsRelations = relations(rounds, ({ one, many }) => ({
  quiz: one(quizzes, { fields: [rounds.quizId], references: [quizzes.id] }),
  questions: many(questions),
}));

export const questionsRelations = relations(questions, ({ one, many }) => ({
  round: one(rounds, { fields: [questions.roundId], references: [rounds.id] }),
  answers: many(answers),
}));

export const gameSessionsRelations = relations(gameSessions, ({ one, many }) => ({
  quiz: one(quizzes, { fields: [gameSessions.quizId], references: [quizzes.id] }),
  teams: many(teams),
  answers: many(answers),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  gameSession: one(gameSessions, { fields: [teams.gameSessionId], references: [gameSessions.id] }),
  answers: many(answers),
}));

export const answersRelations = relations(answers, ({ one }) => ({
  gameSession: one(gameSessions, { fields: [answers.gameSessionId], references: [gameSessions.id] }),
  question: one(questions, { fields: [answers.questionId], references: [questions.id] }),
  team: one(teams, { fields: [answers.teamId], references: [teams.id] }),
}));
