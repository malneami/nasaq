CREATE TYPE "public"."account_type" AS ENUM('checking', 'savings', 'credit_card', 'cash', 'investment', 'other');--> statement-breakpoint
CREATE TYPE "public"."ai_action" AS ENUM('activate', 'maintain', 'incubate', 'reassess', 'stop');--> statement-breakpoint
CREATE TYPE "public"."app_locale" AS ENUM('en', 'ar');--> statement-breakpoint
CREATE TYPE "public"."audit_actor" AS ENUM('user', 'ai', 'system');--> statement-breakpoint
CREATE TYPE "public"."budget_period" AS ENUM('month');--> statement-breakpoint
CREATE TYPE "public"."commitment_direction" AS ENUM('i_promised', 'they_promised');--> statement-breakpoint
CREATE TYPE "public"."commitment_status" AS ENUM('open', 'fulfilled', 'overdue', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."data_source" AS ENUM('manual', 'csv', 'sms', 'email', 'api');--> statement-breakpoint
CREATE TYPE "public"."energy_level" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('shift', 'meeting', 'family', 'appointment', 'deep_work', 'recovery', 'protected', 'other');--> statement-breakpoint
CREATE TYPE "public"."financial_goal_kind" AS ENUM('emergency_fund', 'savings', 'debt', 'investment');--> statement-breakpoint
CREATE TYPE "public"."goal_status" AS ENUM('planned', 'active', 'achieved', 'paused', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."inbox_input_kind" AS ENUM('text', 'voice', 'link', 'note', 'manual_txn');--> statement-breakpoint
CREATE TYPE "public"."inbox_status" AS ENUM('unprocessed', 'processed', 'discarded');--> statement-breakpoint
CREATE TYPE "public"."inbox_type" AS ENUM('task', 'idea', 'project', 'note', 'person', 'follow_up', 'commitment', 'expense', 'income', 'event');--> statement-breakpoint
CREATE TYPE "public"."money_scope" AS ENUM('personal', 'family', 'business');--> statement-breakpoint
CREATE TYPE "public"."project_stage" AS ENUM('idea', 'validation', 'planning', 'building', 'testing', 'launch', 'scale', 'completed');--> statement-breakpoint
CREATE TYPE "public"."project_state" AS ENUM('active', 'maintain', 'waiting', 'incubator', 'someday', 'completed', 'stopped');--> statement-breakpoint
CREATE TYPE "public"."recommendation_status" AS ENUM('pending', 'accepted', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."relationship_category" AS ENUM('partner', 'investor', 'advisor', 'colleague', 'client', 'potential_client', 'professional', 'personal');--> statement-breakpoint
CREATE TYPE "public"."review_type" AS ENUM('weekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."risk_level" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('inbox', 'next', 'scheduled', 'in_progress', 'waiting', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."task_type" AS ENUM('deep_work', 'call', 'meeting', 'communication', 'computer', 'clinical', 'home', 'errand', 'quick_task');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('expense', 'income', 'transfer', 'refund', 'withdrawal', 'deposit', 'fee');--> statement-breakpoint
CREATE TYPE "public"."waiting_status" AS ENUM('waiting', 'received', 'overdue', 'cancelled');--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"display_name" text,
	"locale" "app_locale" DEFAULT 'en' NOT NULL,
	"timezone" text DEFAULT 'Asia/Riyadh' NOT NULL,
	"currency" char(3) DEFAULT 'SAR' NOT NULL,
	"preferences" jsonb DEFAULT '{"active_project_limit":3,"top_outcomes_limit":3,"confidence_threshold":0.7}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "life_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"icon" text,
	"color" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"start_date" date,
	"target_date" date,
	"success_metric" text,
	"status" "goal_status" DEFAULT 'planned' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "goals_progress_range" CHECK ("goals"."progress" >= 0 AND "goals"."progress" <= 100)
);
--> statement-breakpoint
CREATE TABLE "milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"target_date" date,
	"is_done" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_finances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"money_invested" bigint DEFAULT 0 NOT NULL,
	"revenue" bigint DEFAULT 0 NOT NULL,
	"time_invested_minutes" bigint DEFAULT 0 NOT NULL,
	"currency" char(3) DEFAULT 'SAR' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"strategic_fit" smallint NOT NULL,
	"expected_impact" smallint NOT NULL,
	"revenue_potential" smallint NOT NULL,
	"network_value" smallint NOT NULL,
	"personal_interest" smallint NOT NULL,
	"time_requirement" smallint NOT NULL,
	"financial_cost" smallint NOT NULL,
	"complexity" smallint NOT NULL,
	"urgency" smallint NOT NULL,
	"computed_score" integer NOT NULL,
	"ai_recommendation" "ai_action",
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_scores_range" CHECK ("project_scores"."strategic_fit" between 1 and 10
        and "project_scores"."expected_impact" between 1 and 10
        and "project_scores"."revenue_potential" between 1 and 10
        and "project_scores"."network_value" between 1 and 10
        and "project_scores"."personal_interest" between 1 and 10
        and "project_scores"."time_requirement" between 1 and 10
        and "project_scores"."financial_cost" between 1 and 10
        and "project_scores"."complexity" between 1 and 10
        and "project_scores"."urgency" between 1 and 10
        and "project_scores"."computed_score" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"strategic_objective" text,
	"desired_outcome" text,
	"owner" text,
	"state" "project_state" DEFAULT 'incubator' NOT NULL,
	"stage" "project_stage" DEFAULT 'idea' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"current_milestone_id" uuid,
	"next_milestone_id" uuid,
	"target_date" date,
	"next_action" text,
	"risk_level" "risk_level" DEFAULT 'medium' NOT NULL,
	"blockers" text,
	"dependencies" text,
	"time_invested_minutes" bigint DEFAULT 0 NOT NULL,
	"money_invested" bigint DEFAULT 0 NOT NULL,
	"estimated_future_cost" bigint DEFAULT 0 NOT NULL,
	"currency" char(3) DEFAULT 'SAR' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "projects_progress_range" CHECK ("projects"."progress" >= 0 AND "projects"."progress" <= 100)
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"project_id" uuid,
	"owner" text,
	"priority" "task_priority" DEFAULT 'medium' NOT NULL,
	"status" "task_status" DEFAULT 'inbox' NOT NULL,
	"type" "task_type" DEFAULT 'quick_task' NOT NULL,
	"due_date" date,
	"estimated_minutes" integer,
	"energy" "energy_level" DEFAULT 'medium' NOT NULL,
	"context" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"event_type" "event_type" DEFAULT 'other' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"all_day" boolean DEFAULT false NOT NULL,
	"project_id" uuid,
	"contact_id" uuid,
	"is_protected" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"label" text NOT NULL,
	"event_type" "event_type" DEFAULT 'protected' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"is_protected" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"organization" text,
	"role" text,
	"email" text,
	"phone" text,
	"category" "relationship_category" DEFAULT 'personal' NOT NULL,
	"last_interaction_at" timestamp with time zone,
	"next_follow_up_at" timestamp with time zone,
	"notes" text,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"channel" text,
	"summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commitments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"direction" "commitment_direction" NOT NULL,
	"description" text NOT NULL,
	"contact_id" uuid,
	"project_id" uuid,
	"created_date" date DEFAULT now() NOT NULL,
	"due_date" date,
	"status" "commitment_status" DEFAULT 'open' NOT NULL,
	"follow_up_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "waiting_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"contact_id" uuid,
	"org" text,
	"item" text NOT NULL,
	"project_id" uuid,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expected_at" timestamp with time zone,
	"follow_up_at" timestamp with time zone,
	"status" "waiting_status" DEFAULT 'waiting' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "inbox_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"raw_text" text NOT NULL,
	"input_kind" "inbox_input_kind" DEFAULT 'text' NOT NULL,
	"ai_type" "inbox_type",
	"ai_payload" jsonb,
	"ai_confidence" numeric(4, 3),
	"status" "inbox_status" DEFAULT 'unprocessed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"account_type" "account_type" DEFAULT 'cash' NOT NULL,
	"currency" char(3) DEFAULT 'SAR' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category_id" uuid,
	"period" "budget_period" DEFAULT 'month' NOT NULL,
	"amount" bigint DEFAULT 0 NOT NULL,
	"currency" char(3) DEFAULT 'SAR' NOT NULL,
	"month" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"target_amount" bigint DEFAULT 0 NOT NULL,
	"current_amount" bigint DEFAULT 0 NOT NULL,
	"currency" char(3) DEFAULT 'SAR' NOT NULL,
	"target_date" date,
	"kind" "financial_goal_kind" DEFAULT 'savings' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaction_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"parent_id" uuid,
	"is_default" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"occurred_on" date NOT NULL,
	"occurred_at" timestamp with time zone,
	"amount" bigint DEFAULT 0 NOT NULL,
	"currency" char(3) DEFAULT 'SAR' NOT NULL,
	"type" "transaction_type" NOT NULL,
	"merchant" text,
	"category_id" uuid,
	"scope" "money_scope" DEFAULT 'personal' NOT NULL,
	"project_id" uuid,
	"notes" text,
	"source" "data_source" DEFAULT 'manual' NOT NULL,
	"confidence" numeric(4, 3),
	"source_ref" text,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "daily_briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"brief_date" date NOT NULL,
	"content" jsonb NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"review_type" "review_type" DEFAULT 'weekly' NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"content" jsonb NOT NULL,
	"top_outcomes" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"confidence" numeric(4, 3),
	"status" "recommendation_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"actor" "audit_actor" NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"entity_type" text,
	"entity_id" uuid,
	"is_read" boolean DEFAULT false NOT NULL,
	"scheduled_for" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goal_life_areas" (
	"user_id" uuid NOT NULL,
	"goal_id" uuid NOT NULL,
	"life_area_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goal_life_areas_goal_id_life_area_id_pk" PRIMARY KEY("goal_id","life_area_id")
);
--> statement-breakpoint
CREATE TABLE "goal_projects" (
	"user_id" uuid NOT NULL,
	"goal_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goal_projects_goal_id_project_id_pk" PRIMARY KEY("goal_id","project_id")
);
--> statement-breakpoint
CREATE TABLE "project_life_areas" (
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"life_area_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_life_areas_project_id_life_area_id_pk" PRIMARY KEY("project_id","life_area_id")
);
--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_finances" ADD CONSTRAINT "project_finances_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_scores" ADD CONSTRAINT "project_scores_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commitments" ADD CONSTRAINT "commitments_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commitments" ADD CONSTRAINT "commitments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waiting_items" ADD CONSTRAINT "waiting_items_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waiting_items" ADD CONSTRAINT "waiting_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_category_id_transaction_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."transaction_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_transaction_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."transaction_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_life_areas" ADD CONSTRAINT "goal_life_areas_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_life_areas" ADD CONSTRAINT "goal_life_areas_life_area_id_life_areas_id_fk" FOREIGN KEY ("life_area_id") REFERENCES "public"."life_areas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_projects" ADD CONSTRAINT "goal_projects_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_projects" ADD CONSTRAINT "goal_projects_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_life_areas" ADD CONSTRAINT "project_life_areas_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_life_areas" ADD CONSTRAINT "project_life_areas_life_area_id_life_areas_id_fk" FOREIGN KEY ("life_area_id") REFERENCES "public"."life_areas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "life_areas_user_id_idx" ON "life_areas" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "life_areas_user_name_idx" ON "life_areas" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "goals_user_id_idx" ON "goals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "goals_user_status_idx" ON "goals" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "milestones_user_id_idx" ON "milestones" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "milestones_project_id_idx" ON "milestones" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_finances_user_id_idx" ON "project_finances" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_finances_project_id_idx" ON "project_finances" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_scores_user_id_idx" ON "project_scores" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "project_scores_project_id_idx" ON "project_scores" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "projects_user_id_idx" ON "projects" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "projects_user_state_idx" ON "projects" USING btree ("user_id","state");--> statement-breakpoint
CREATE INDEX "projects_target_date_idx" ON "projects" USING btree ("user_id","target_date");--> statement-breakpoint
CREATE INDEX "tasks_user_id_idx" ON "tasks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tasks_user_status_idx" ON "tasks" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "tasks_project_id_idx" ON "tasks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "tasks_due_date_idx" ON "tasks" USING btree ("user_id","due_date");--> statement-breakpoint
CREATE INDEX "calendar_events_user_id_idx" ON "calendar_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "calendar_events_starts_at_idx" ON "calendar_events" USING btree ("user_id","starts_at");--> statement-breakpoint
CREATE INDEX "calendar_events_project_id_idx" ON "calendar_events" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "time_blocks_user_id_idx" ON "time_blocks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "time_blocks_starts_at_idx" ON "time_blocks" USING btree ("user_id","starts_at");--> statement-breakpoint
CREATE INDEX "contacts_user_id_idx" ON "contacts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "contacts_category_idx" ON "contacts" USING btree ("user_id","category");--> statement-breakpoint
CREATE INDEX "contacts_next_follow_up_idx" ON "contacts" USING btree ("user_id","next_follow_up_at");--> statement-breakpoint
CREATE INDEX "interactions_user_id_idx" ON "interactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "interactions_contact_id_idx" ON "interactions" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "commitments_user_id_idx" ON "commitments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "commitments_status_idx" ON "commitments" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "commitments_due_date_idx" ON "commitments" USING btree ("user_id","due_date");--> statement-breakpoint
CREATE INDEX "commitments_project_id_idx" ON "commitments" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "waiting_items_user_id_idx" ON "waiting_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "waiting_items_status_idx" ON "waiting_items" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "waiting_items_project_id_idx" ON "waiting_items" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "inbox_items_user_id_idx" ON "inbox_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "inbox_items_status_idx" ON "inbox_items" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_user_name_idx" ON "accounts" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "budgets_user_id_idx" ON "budgets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "budgets_month_idx" ON "budgets" USING btree ("user_id","month");--> statement-breakpoint
CREATE INDEX "budgets_category_id_idx" ON "budgets" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "financial_goals_user_id_idx" ON "financial_goals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transaction_categories_user_id_idx" ON "transaction_categories" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transaction_categories_user_name_idx" ON "transaction_categories" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "transactions_user_id_idx" ON "transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transactions_account_id_idx" ON "transactions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "transactions_occurred_on_idx" ON "transactions" USING btree ("user_id","occurred_on");--> statement-breakpoint
CREATE INDEX "transactions_project_id_idx" ON "transactions" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "transactions_category_id_idx" ON "transactions" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_user_external_id_idx" ON "transactions" USING btree ("user_id","external_id");--> statement-breakpoint
CREATE INDEX "daily_briefs_user_id_idx" ON "daily_briefs" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_briefs_user_date_idx" ON "daily_briefs" USING btree ("user_id","brief_date");--> statement-breakpoint
CREATE INDEX "weekly_reviews_user_id_idx" ON "weekly_reviews" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "weekly_reviews_period_idx" ON "weekly_reviews" USING btree ("user_id","period_start");--> statement-breakpoint
CREATE INDEX "ai_recommendations_user_id_idx" ON "ai_recommendations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_recommendations_subject_idx" ON "ai_recommendations" USING btree ("user_id","subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "ai_recommendations_status_idx" ON "ai_recommendations" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "notifications_user_id_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_is_read_idx" ON "notifications" USING btree ("user_id","is_read");--> statement-breakpoint
CREATE INDEX "goal_life_areas_user_id_idx" ON "goal_life_areas" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "goal_projects_user_id_idx" ON "goal_projects" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "project_life_areas_user_id_idx" ON "project_life_areas" USING btree ("user_id");