CREATE TABLE "project_contacts" (
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"role" text DEFAULT 'stakeholder' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_contacts_project_id_contact_id_pk" PRIMARY KEY("project_id","contact_id")
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "links" jsonb;--> statement-breakpoint
ALTER TABLE "project_contacts" ADD CONSTRAINT "project_contacts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_contacts" ADD CONSTRAINT "project_contacts_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_contacts_user_id_idx" ON "project_contacts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "project_contacts_contact_id_idx" ON "project_contacts" USING btree ("contact_id");
--> statement-breakpoint
ALTER TABLE "project_contacts"
  ADD CONSTRAINT "project_contacts_user_id_auth_fkey"
  FOREIGN KEY ("user_id") REFERENCES auth.users(id) ON DELETE cascade;
--> statement-breakpoint
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.project_contacts
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_contacts TO anon, authenticated, service_role;
--> statement-breakpoint
ALTER TABLE public.project_contacts ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY project_contacts_own_all
  ON public.project_contacts
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());