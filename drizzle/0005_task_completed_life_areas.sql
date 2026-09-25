ALTER TABLE "tasks" ADD COLUMN "completed_at" timestamp with time zone;
--> statement-breakpoint
CREATE TABLE "task_life_areas" (
	"user_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"life_area_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_life_areas_task_id_life_area_id_pk" PRIMARY KEY("task_id","life_area_id")
);
--> statement-breakpoint
ALTER TABLE "task_life_areas" ADD CONSTRAINT "task_life_areas_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "task_life_areas" ADD CONSTRAINT "task_life_areas_life_area_id_life_areas_id_fk" FOREIGN KEY ("life_area_id") REFERENCES "public"."life_areas"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "task_life_areas_user_id_idx" ON "task_life_areas" USING btree ("user_id");
--> statement-breakpoint
ALTER TABLE "task_life_areas"
  ADD CONSTRAINT "task_life_areas_user_id_auth_fkey"
  FOREIGN KEY ("user_id") REFERENCES auth.users(id) ON DELETE cascade;
--> statement-breakpoint
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.task_life_areas
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_life_areas TO anon, authenticated, service_role;
--> statement-breakpoint
ALTER TABLE public.task_life_areas ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY task_life_areas_own_all
  ON public.task_life_areas
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
