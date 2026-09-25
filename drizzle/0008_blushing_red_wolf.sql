CREATE TABLE "merchant_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"normalized_merchant" text NOT NULL,
	"category_id" uuid NOT NULL,
	"scope" "money_scope",
	"hit_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "parent_task_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "shift_kind" text;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "recurrence" jsonb;--> statement-breakpoint
ALTER TABLE "time_blocks" ADD COLUMN "weekday" integer;--> statement-breakpoint
ALTER TABLE "time_blocks" ADD COLUMN "start_hm" text;--> statement-breakpoint
ALTER TABLE "time_blocks" ADD COLUMN "end_hm" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "card_label" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "needs_review" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "merchant_rules" ADD CONSTRAINT "merchant_rules_category_id_transaction_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."transaction_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_notes" ADD CONSTRAINT "project_notes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "merchant_rules_user_id_idx" ON "merchant_rules" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_rules_user_merchant_idx" ON "merchant_rules" USING btree ("user_id","normalized_merchant");--> statement-breakpoint
CREATE INDEX "project_notes_user_id_idx" ON "project_notes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "project_notes_project_id_idx" ON "project_notes" USING btree ("project_id");--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_task_id_tasks_id_fk" FOREIGN KEY ("parent_task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tasks_parent_task_id_idx" ON "tasks" USING btree ("parent_task_id");