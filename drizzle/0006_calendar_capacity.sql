ALTER TABLE "calendar_events" ADD COLUMN "shift_kind" text;
--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "recurrence" jsonb;
--> statement-breakpoint
ALTER TABLE "time_blocks" ADD COLUMN "weekday" integer;
--> statement-breakpoint
ALTER TABLE "time_blocks" ADD COLUMN "start_hm" text;
--> statement-breakpoint
ALTER TABLE "time_blocks" ADD COLUMN "end_hm" text;
