-- Modify "users" table
ALTER TABLE "public"."users" ADD CONSTRAINT "first_name_length" CHECK (length((first_name)::text) > 2), ADD CONSTRAINT "last_name_length" CHECK (length((first_name)::text) > 1), ADD CONSTRAINT "password_min_length" CHECK (length((password)::text) >= 8);
