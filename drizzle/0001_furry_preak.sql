CREATE TABLE "archive_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operator" varchar(255) NOT NULL,
	"operate_time" varchar(50) NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"batch_id" uuid,
	"batch_name" varchar(255),
	"domain" varchar(50)
);
--> statement-breakpoint
CREATE TABLE "authz_roles" (
	"biz_id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"role_members" jsonb,
	"_created_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_updated_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "preview_store" (
	"preview_id" varchar(255) PRIMARY KEY NOT NULL,
	"domain" varchar(50) DEFAULT 'welding' NOT NULL,
	"items" jsonb NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_message" ALTER COLUMN "_created_by" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "agent_message" ALTER COLUMN "_updated_by" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "agent_session" ALTER COLUMN "_created_by" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "agent_session" ALTER COLUMN "_updated_by" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "authz_permissions" ALTER COLUMN "_created_by" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "authz_permissions" ALTER COLUMN "_updated_by" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "authz_role_permissions" ALTER COLUMN "_created_by" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "authz_role_permissions" ALTER COLUMN "_updated_by" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "contract" ALTER COLUMN "_created_by" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "contract" ALTER COLUMN "_updated_by" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "estimate_task" ALTER COLUMN "_created_by" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "estimate_task" ALTER COLUMN "_updated_by" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "manufacturing_contract" ALTER COLUMN "_created_by" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "manufacturing_contract" ALTER COLUMN "_updated_by" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "model" ALTER COLUMN "_created_by" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "model" ALTER COLUMN "_updated_by" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "painting_contract" ALTER COLUMN "_created_by" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "painting_contract" ALTER COLUMN "_updated_by" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "pending_item" ALTER COLUMN "_created_by" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "pending_item" ALTER COLUMN "_updated_by" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "stamping_contract" ALTER COLUMN "_created_by" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "stamping_contract" ALTER COLUMN "_updated_by" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "unit_std" ALTER COLUMN "_created_by" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "unit_std" ALTER COLUMN "_updated_by" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "estimate_task" ADD COLUMN "row_results" jsonb;