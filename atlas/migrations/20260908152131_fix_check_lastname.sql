-- Modify "users" table
ALTER TABLE "public"."users" DROP CONSTRAINT "last_name_length", ADD CONSTRAINT "last_name_length" CHECK (length((last_name)::text) > 1);
