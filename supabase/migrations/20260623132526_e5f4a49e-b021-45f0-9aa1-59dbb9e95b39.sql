
ALTER TABLE public.training_types ADD COLUMN IF NOT EXISTS sessions_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS sessions_total integer NOT NULL DEFAULT 0;
