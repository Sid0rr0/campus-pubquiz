ALTER TABLE "questions" ADD COLUMN "answer" text;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "notes" text;--> statement-breakpoint
UPDATE "questions" SET "answer" = "payload"->>'answer' WHERE "answer" IS NULL;--> statement-breakpoint
ALTER TABLE "questions" ALTER COLUMN "answer" SET NOT NULL;
