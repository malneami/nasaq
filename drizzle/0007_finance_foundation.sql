ALTER TABLE "transactions" ADD COLUMN "card_label" text;
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "needs_review" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
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
ALTER TABLE "merchant_rules" ADD CONSTRAINT "merchant_rules_category_id_transaction_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."transaction_categories"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "merchant_rules_user_id_idx" ON "merchant_rules" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_rules_user_merchant_idx" ON "merchant_rules" USING btree ("user_id","normalized_merchant");
--> statement-breakpoint
ALTER TABLE "merchant_rules" ADD CONSTRAINT "merchant_rules_user_id_auth_fkey" FOREIGN KEY ("user_id") REFERENCES auth.users(id) ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "merchant_rules" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "merchant_rules_owner" ON "merchant_rules" FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "merchant_rules" TO authenticated;
