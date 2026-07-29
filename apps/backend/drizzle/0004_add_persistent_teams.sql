-- Persistent, season-spanning team identity: teams are no longer scoped to
-- a single game_session_id row, so any existing team/answer data can no
-- longer satisfy the new global-unique-name constraint. Reset per plan.
TRUNCATE TABLE "answers", "teams" CASCADE;--> statement-breakpoint
ALTER TABLE "teams" DROP CONSTRAINT "teams_game_session_id_game_sessions_id_fk";--> statement-breakpoint
DROP INDEX "teams_game_session_id_name_idx";--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "code" text NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" DROP COLUMN "game_session_id";--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_name_unique" UNIQUE("name");--> statement-breakpoint
CREATE TABLE "game_session_teams" (
	"game_session_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_session_teams_game_session_id_team_id_pk" PRIMARY KEY("game_session_id","team_id")
);
--> statement-breakpoint
ALTER TABLE "game_session_teams" ADD CONSTRAINT "game_session_teams_game_session_id_game_sessions_id_fk" FOREIGN KEY ("game_session_id") REFERENCES "public"."game_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_session_teams" ADD CONSTRAINT "game_session_teams_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
