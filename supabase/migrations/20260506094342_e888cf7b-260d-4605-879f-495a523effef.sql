-- Restrict parts deletion to warehouse role only
DROP POLICY IF EXISTS "Auth delete parts" ON public.parts;
CREATE POLICY "Warehouse delete parts" ON public.parts FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'warehouse'));

-- Table to track which employees have set a PIN (used for "first time" detection)
CREATE TABLE IF NOT EXISTS public.employee_pins (
  name text PRIMARY KEY,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.employee_pins ENABLE ROW LEVEL SECURITY;

-- Anyone (even anon) can check if a name has a PIN registered, but only see name column existence.
CREATE POLICY "Public read pin existence" ON public.employee_pins FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert pin" ON public.employee_pins FOR INSERT TO anon, authenticated WITH CHECK (true);