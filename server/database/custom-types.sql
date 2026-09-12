-- Create custom composite types for the welding cost system

-- User profile type (stores user ID reference)
DO $$ BEGIN
  CREATE TYPE user_profile AS (
    user_id text
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- File attachment type (stores bucket and path)
DO $$ BEGIN
  CREATE TYPE file_attachment AS (
    bucket_id text,
    file_path text
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create array types (PostgreSQL automatically creates these for composite types)
-- user_profile[] and file_attachment[] are auto-created
