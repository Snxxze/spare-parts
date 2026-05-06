
-- Roles enum and table
CREATE TYPE public.app_role AS ENUM ('employee', 'warehouse');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Parts
CREATE TABLE public.parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  expiry_date DATE,
  min_stock_alert INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Requisitions
CREATE TYPE public.req_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.requisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_number TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT,
  status req_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id)
);

CREATE TABLE public.requisition_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id UUID NOT NULL REFERENCES public.requisitions(id) ON DELETE CASCADE,
  part_id UUID NOT NULL REFERENCES public.parts(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0)
);

-- Stock movements
CREATE TYPE public.movement_type AS ENUM ('issue', 'refill');

CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id UUID NOT NULL REFERENCES public.parts(id) ON DELETE CASCADE,
  type movement_type NOT NULL,
  quantity INTEGER NOT NULL,
  ref_requisition_id UUID REFERENCES public.requisitions(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requisition_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- RLS profiles
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Warehouse view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'warehouse'));
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- RLS user_roles
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- RLS parts (any authenticated user can manage)
CREATE POLICY "Auth read parts" ON public.parts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert parts" ON public.parts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update parts" ON public.parts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete parts" ON public.parts FOR DELETE TO authenticated USING (true);

-- RLS requisitions
CREATE POLICY "Users view own reqs" ON public.requisitions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Warehouse view all reqs" ON public.requisitions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'warehouse'));
CREATE POLICY "Users insert own reqs" ON public.requisitions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Warehouse update reqs" ON public.requisitions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'warehouse'));

-- RLS requisition_items
CREATE POLICY "View own req items" ON public.requisition_items FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.requisitions r WHERE r.id = requisition_id AND (r.user_id = auth.uid() OR public.has_role(auth.uid(), 'warehouse')))
);
CREATE POLICY "Insert own req items" ON public.requisition_items FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.requisitions r WHERE r.id = requisition_id AND r.user_id = auth.uid())
);

-- RLS stock_movements
CREATE POLICY "Auth read movements" ON public.stock_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert movements" ON public.stock_movements FOR INSERT TO authenticated WITH CHECK (true);

-- Trigger: auto-create profile + default employee role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger for parts
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER parts_updated_at BEFORE UPDATE ON public.parts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Doc number generator
CREATE OR REPLACE FUNCTION public.gen_doc_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  d TEXT := to_char(now(), 'YYYYMMDD');
  cnt INTEGER;
BEGIN
  IF NEW.doc_number IS NULL OR NEW.doc_number = '' THEN
    SELECT COUNT(*) + 1 INTO cnt FROM public.requisitions
      WHERE doc_number LIKE 'REQ-' || d || '-%';
    NEW.doc_number := 'REQ-' || d || '-' || LPAD(cnt::text, 4, '0');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER requisitions_doc_number BEFORE INSERT ON public.requisitions
FOR EACH ROW EXECUTE FUNCTION public.gen_doc_number();

-- On approval: deduct stock + log issue movements
CREATE OR REPLACE FUNCTION public.handle_req_approval()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE item RECORD;
BEGIN
  IF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
    FOR item IN SELECT part_id, quantity FROM public.requisition_items WHERE requisition_id = NEW.id LOOP
      UPDATE public.parts SET quantity = quantity - item.quantity WHERE id = item.part_id;
      INSERT INTO public.stock_movements (part_id, type, quantity, ref_requisition_id, created_by)
      VALUES (item.part_id, 'issue', item.quantity, NEW.id, NEW.reviewed_by);
    END LOOP;
    NEW.reviewed_at := now();
  ELSIF NEW.status = 'rejected' AND OLD.status <> 'rejected' THEN
    NEW.reviewed_at := now();
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER requisitions_on_approval BEFORE UPDATE ON public.requisitions
FOR EACH ROW EXECUTE FUNCTION public.handle_req_approval();

-- Refill movement logging on parts insert/update
CREATE OR REPLACE FUNCTION public.log_part_refill()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE diff INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.quantity > 0 THEN
      INSERT INTO public.stock_movements (part_id, type, quantity, created_by)
      VALUES (NEW.id, 'refill', NEW.quantity, auth.uid());
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    diff := NEW.quantity - OLD.quantity;
    IF diff > 0 THEN
      INSERT INTO public.stock_movements (part_id, type, quantity, created_by)
      VALUES (NEW.id, 'refill', diff, auth.uid());
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER parts_log_refill AFTER INSERT OR UPDATE OF quantity ON public.parts
FOR EACH ROW EXECUTE FUNCTION public.log_part_refill();
