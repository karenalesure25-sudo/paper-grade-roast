CREATE TABLE public.intakes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tier TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  target_job_title TEXT,
  career_field TEXT,
  company_name TEXT,
  specific_job_title TEXT,
  job_url TEXT,
  job_description TEXT,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  resume_path TEXT,
  resume_filename TEXT,
  job_file_path TEXT,
  job_file_filename TEXT,
  confirmed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT ALL ON public.intakes TO service_role;
ALTER TABLE public.intakes ENABLE ROW LEVEL SECURITY;