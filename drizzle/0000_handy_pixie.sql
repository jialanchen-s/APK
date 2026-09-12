CREATE TABLE "agent_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"role" varchar(50) NOT NULL,
	"content" text,
	"message_type" varchar(50) DEFAULT 'text',
	"metadata" jsonb,
	"status" varchar(50) DEFAULT 'sent',
	"_created_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_created_by" "user_profile",
	"_updated_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_updated_by" "user_profile"
);
--> statement-breakpoint
CREATE TABLE "agent_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255),
	"status" varchar(50) DEFAULT 'active',
	"task_id" uuid,
	"context" jsonb,
	"_created_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_created_by" "user_profile",
	"_updated_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_updated_by" "user_profile"
);
--> statement-breakpoint
CREATE TABLE "authz_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" varchar(100) NOT NULL,
	"subject" varchar(100) NOT NULL,
	"description" text,
	"_created_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_created_by" "user_profile",
	"_updated_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_updated_by" "user_profile"
);
--> statement-breakpoint
CREATE TABLE "authz_role_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_key" varchar(100) NOT NULL,
	"permission_id" uuid NOT NULL,
	"_created_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_created_by" "user_profile",
	"_updated_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_updated_by" "user_profile"
);
--> statement-breakpoint
CREATE TABLE "contract" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project" varchar(100),
	"line_type" varchar(50),
	"device_material_name" varchar(255) NOT NULL,
	"usage_scope" varchar(50),
	"category" varchar(100),
	"distinction" varchar(50),
	"copy_mode" varchar(50),
	"unit_price" numeric,
	"price_caliber" varchar(50) DEFAULT '未税',
	"supply" varchar(50),
	"unit" varchar(50),
	"settle_date" timestamptz (6),
	"archive_operator" "user_profile",
	"archive_time" timestamptz (6) DEFAULT CURRENT_TIMESTAMP,
	"quantity" numeric,
	"selected_brand" varchar(255),
	"subtotal" numeric,
	"remark" text,
	"workstation_no" varchar(100),
	"workstation_desc" varchar(255),
	"archive_batch_id" uuid,
	"archive_batch_name" varchar(255),
	"status" varchar(50) DEFAULT 'pending_review' NOT NULL,
	"reviewer" "user_profile",
	"review_time" timestamptz (6),
	"review_remark" text,
	"project_time" varchar(20),
	"factory_name" varchar(100),
	"_created_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_created_by" "user_profile",
	"_updated_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_updated_by" "user_profile"
);
--> statement-breakpoint
CREATE TABLE "estimate_task" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"status" varchar(50) DEFAULT 'pending',
	"total_rows" integer DEFAULT 0,
	"success_rows" integer DEFAULT 0,
	"jia_gong_rows" integer DEFAULT 0,
	"pending_rows" integer DEFAULT 0,
	"main_result_url" text,
	"unknown_result_url" text,
	"domain" varchar(50) DEFAULT 'welding' NOT NULL,
	"_created_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_created_by" "user_profile",
	"_updated_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_updated_by" "user_profile"
);
--> statement-breakpoint
CREATE TABLE "manufacturing_contract" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project" varchar(100),
	"line_type" varchar(50),
	"device_material_name" varchar(255) NOT NULL,
	"usage_scope" varchar(50),
	"category" varchar(100),
	"distinction" varchar(50),
	"copy_mode" varchar(50),
	"unit_price" numeric,
	"price_caliber" varchar(50) DEFAULT '未税',
	"supply" varchar(50),
	"unit" varchar(50),
	"settle_date" timestamptz (6),
	"archive_operator" "user_profile",
	"archive_time" timestamptz (6) DEFAULT CURRENT_TIMESTAMP,
	"quantity" numeric,
	"selected_brand" varchar(255),
	"subtotal" numeric,
	"remark" text,
	"workstation_no" varchar(100),
	"workstation_desc" varchar(255),
	"archive_batch_id" uuid,
	"archive_batch_name" varchar(255),
	"status" varchar(50) DEFAULT 'pending_review' NOT NULL,
	"reviewer" "user_profile",
	"review_time" timestamptz (6),
	"review_remark" text,
	"specification" varchar(255),
	"project_time" varchar(20),
	"factory_name" varchar(100),
	"_created_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_created_by" "user_profile",
	"_updated_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_updated_by" "user_profile"
);
--> statement-breakpoint
CREATE TABLE "model" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_id" varchar(100) NOT NULL,
	"model_name" varchar(255) NOT NULL,
	"applicable_type" varchar(100),
	"input_vars" jsonb,
	"formula_logic" text,
	"constants" jsonb,
	"constants_version" varchar(50),
	"maintainer" "user_profile",
	"status" varchar(50) DEFAULT 'draft',
	"_created_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_created_by" "user_profile",
	"_updated_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_updated_by" "user_profile"
);
--> statement-breakpoint
CREATE TABLE "painting_contract" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project" varchar(100),
	"line_type" varchar(50),
	"device_material_name" varchar(255) NOT NULL,
	"usage_scope" varchar(50),
	"category" varchar(100),
	"distinction" varchar(50),
	"copy_mode" varchar(50),
	"unit_price" numeric,
	"price_caliber" varchar(50) DEFAULT '未税',
	"supply" varchar(50),
	"unit" varchar(50),
	"settle_date" timestamptz (6),
	"archive_operator" "user_profile",
	"archive_time" timestamptz (6) DEFAULT CURRENT_TIMESTAMP,
	"quantity" numeric,
	"selected_brand" varchar(255),
	"subtotal" numeric,
	"remark" text,
	"workstation_no" varchar(100),
	"workstation_desc" varchar(255),
	"archive_batch_id" uuid,
	"archive_batch_name" varchar(255),
	"status" varchar(50) DEFAULT 'pending_review' NOT NULL,
	"reviewer" "user_profile",
	"review_time" timestamptz (6),
	"review_remark" text,
	"specification" varchar(255),
	"project_time" varchar(20),
	"factory_name" varchar(100),
	"_created_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_created_by" "user_profile",
	"_updated_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_updated_by" "user_profile"
);
--> statement-breakpoint
CREATE TABLE "pending_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid,
	"group_type" varchar(50) NOT NULL,
	"model_id" varchar(100),
	"device_name" varchar(255) NOT NULL,
	"params" jsonb,
	"filled_values" jsonb,
	"status" varchar(50) DEFAULT 'pending',
	"spec_remark" varchar(500),
	"_created_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_created_by" "user_profile",
	"_updated_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_updated_by" "user_profile"
);
--> statement-breakpoint
CREATE TABLE "stamping_contract" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project" varchar(100),
	"line_type" varchar(50),
	"device_material_name" varchar(255) NOT NULL,
	"usage_scope" varchar(50),
	"category" varchar(100),
	"distinction" varchar(50),
	"copy_mode" varchar(50),
	"unit_price" numeric,
	"price_caliber" varchar(50) DEFAULT '未税',
	"supply" varchar(50),
	"unit" varchar(50),
	"settle_date" timestamptz (6),
	"archive_operator" "user_profile",
	"archive_time" timestamptz (6) DEFAULT CURRENT_TIMESTAMP,
	"quantity" numeric,
	"selected_brand" varchar(255),
	"subtotal" numeric,
	"remark" text,
	"workstation_no" varchar(100),
	"workstation_desc" varchar(255),
	"archive_batch_id" uuid,
	"archive_batch_name" varchar(255),
	"status" varchar(50) DEFAULT 'pending_review' NOT NULL,
	"reviewer" "user_profile",
	"review_time" timestamptz (6),
	"review_remark" text,
	"specification" varchar(255),
	"project_time" varchar(20),
	"factory_name" varchar(100),
	"_created_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_created_by" "user_profile",
	"_updated_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_updated_by" "user_profile"
);
--> statement-breakpoint
CREATE TABLE "unit_std" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_std" varchar(50) NOT NULL,
	"aliases" jsonb,
	"convertible" boolean DEFAULT false,
	"convert_coefficient" numeric DEFAULT '1.0',
	"_created_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_created_by" "user_profile",
	"_updated_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_updated_by" "user_profile"
);
--> statement-breakpoint
ALTER TABLE "authz_role_permissions" ADD CONSTRAINT "authz_role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."authz_permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_agent_message_session_id" ON "agent_message" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_agent_session_status" ON "agent_session" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_agent_session_task_id" ON "agent_session" USING btree ("task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "authz_permissions_action_subject_key" ON "authz_permissions" USING btree ("action","subject");--> statement-breakpoint
CREATE UNIQUE INDEX "authz_role_permissions_role_key_permission_id_key" ON "authz_role_permissions" USING btree ("role_key","permission_id");--> statement-breakpoint
CREATE INDEX "idx_authz_role_permissions_role_key" ON "authz_role_permissions" USING btree ("role_key");--> statement-breakpoint
CREATE INDEX "idx_contract_line_type" ON "contract" USING btree ("line_type");--> statement-breakpoint
CREATE INDEX "idx_contract_device_material_name" ON "contract" USING btree ("device_material_name");--> statement-breakpoint
CREATE INDEX "idx_contract_supply" ON "contract" USING btree ("supply");--> statement-breakpoint
CREATE INDEX "idx_contract_archive_batch_id" ON "contract" USING btree ("archive_batch_id");--> statement-breakpoint
CREATE INDEX "idx_contract_status" ON "contract" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_estimate_task_status" ON "estimate_task" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_manufacturing_contract_line_type" ON "manufacturing_contract" USING btree ("line_type");--> statement-breakpoint
CREATE INDEX "idx_manufacturing_contract_device_material_name" ON "manufacturing_contract" USING btree ("device_material_name");--> statement-breakpoint
CREATE INDEX "idx_manufacturing_contract_supply" ON "manufacturing_contract" USING btree ("supply");--> statement-breakpoint
CREATE INDEX "idx_manufacturing_contract_archive_batch_id" ON "manufacturing_contract" USING btree ("archive_batch_id");--> statement-breakpoint
CREATE INDEX "idx_manufacturing_contract_status" ON "manufacturing_contract" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_model_model_id" ON "model" USING btree ("model_id");--> statement-breakpoint
CREATE INDEX "idx_model_status" ON "model" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_painting_contract_line_type" ON "painting_contract" USING btree ("line_type");--> statement-breakpoint
CREATE INDEX "idx_painting_contract_device_material_name" ON "painting_contract" USING btree ("device_material_name");--> statement-breakpoint
CREATE INDEX "idx_painting_contract_supply" ON "painting_contract" USING btree ("supply");--> statement-breakpoint
CREATE INDEX "idx_painting_contract_archive_batch_id" ON "painting_contract" USING btree ("archive_batch_id");--> statement-breakpoint
CREATE INDEX "idx_painting_contract_status" ON "painting_contract" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_pending_item_task_id" ON "pending_item" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "idx_pending_item_group_type" ON "pending_item" USING btree ("group_type");--> statement-breakpoint
CREATE INDEX "idx_pending_item_status" ON "pending_item" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_stamping_contract_line_type" ON "stamping_contract" USING btree ("line_type");--> statement-breakpoint
CREATE INDEX "idx_stamping_contract_device_material_name" ON "stamping_contract" USING btree ("device_material_name");--> statement-breakpoint
CREATE INDEX "idx_stamping_contract_supply" ON "stamping_contract" USING btree ("supply");--> statement-breakpoint
CREATE INDEX "idx_stamping_contract_archive_batch_id" ON "stamping_contract" USING btree ("archive_batch_id");--> statement-breakpoint
CREATE INDEX "idx_stamping_contract_status" ON "stamping_contract" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_unit_std_unit" ON "unit_std" USING btree ("unit_std");