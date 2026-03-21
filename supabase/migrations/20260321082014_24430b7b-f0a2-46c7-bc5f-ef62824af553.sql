
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  pilot_name TEXT,
  glider_info TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Locations
CREATE TYPE public.location_type AS ENUM ('takeoff', 'landing', 'both');
CREATE TABLE public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  type location_type NOT NULL DEFAULT 'both',
  altitude INTEGER,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- Flights
CREATE TABLE public.flights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  takeoff_location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  landing_location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  duration_minutes INTEGER,
  altitude_gain INTEGER,
  distance_km NUMERIC(7,2),
  thermals TEXT,
  wind_speed INTEGER,
  wind_direction TEXT,
  glider TEXT,
  comments TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.flights ENABLE ROW LEVEL SECURITY;

-- Flight photos
CREATE TABLE public.flight_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_id UUID REFERENCES public.flights(id) ON DELETE CASCADE NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.flight_photos ENABLE ROW LEVEL SECURITY;

-- Flight videos
CREATE TABLE public.flight_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_id UUID REFERENCES public.flights(id) ON DELETE CASCADE NOT NULL,
  youtube_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.flight_videos ENABLE ROW LEVEL SECURITY;

-- IGC tracks
CREATE TABLE public.igc_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_id UUID REFERENCES public.flights(id) ON DELETE CASCADE NOT NULL,
  storage_path TEXT NOT NULL,
  track_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.igc_tracks ENABLE ROW LEVEL SECURITY;

-- User roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Helper function: ownership of flight
CREATE OR REPLACE FUNCTION public.is_owner_of_flight(_flight_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.flights WHERE id = _flight_id AND user_id = auth.uid()
  )
$$;

-- Helper: has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON public.locations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_flights_updated_at BEFORE UPDATE ON public.flights FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, pilot_name) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS: profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- RLS: locations
CREATE POLICY "Users can view own locations" ON public.locations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own locations" ON public.locations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own locations" ON public.locations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own locations" ON public.locations FOR DELETE USING (auth.uid() = user_id);

-- RLS: flights
CREATE POLICY "Users can view own flights" ON public.flights FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own flights" ON public.flights FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own flights" ON public.flights FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own flights" ON public.flights FOR DELETE USING (auth.uid() = user_id);

-- RLS: flight_photos (via flight ownership)
CREATE POLICY "Users can view own flight photos" ON public.flight_photos FOR SELECT USING (public.is_owner_of_flight(flight_id));
CREATE POLICY "Users can insert own flight photos" ON public.flight_photos FOR INSERT WITH CHECK (public.is_owner_of_flight(flight_id));
CREATE POLICY "Users can delete own flight photos" ON public.flight_photos FOR DELETE USING (public.is_owner_of_flight(flight_id));

-- RLS: flight_videos
CREATE POLICY "Users can view own flight videos" ON public.flight_videos FOR SELECT USING (public.is_owner_of_flight(flight_id));
CREATE POLICY "Users can insert own flight videos" ON public.flight_videos FOR INSERT WITH CHECK (public.is_owner_of_flight(flight_id));
CREATE POLICY "Users can delete own flight videos" ON public.flight_videos FOR DELETE USING (public.is_owner_of_flight(flight_id));

-- RLS: igc_tracks
CREATE POLICY "Users can view own igc tracks" ON public.igc_tracks FOR SELECT USING (public.is_owner_of_flight(flight_id));
CREATE POLICY "Users can insert own igc tracks" ON public.igc_tracks FOR INSERT WITH CHECK (public.is_owner_of_flight(flight_id));
CREATE POLICY "Users can delete own igc tracks" ON public.igc_tracks FOR DELETE USING (public.is_owner_of_flight(flight_id));

-- RLS: user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('flight-photos', 'flight-photos', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('igc-files', 'igc-files', false);

-- Storage policies: flight-photos
CREATE POLICY "Authenticated users can upload flight photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'flight-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Anyone can view flight photos" ON storage.objects FOR SELECT USING (bucket_id = 'flight-photos');
CREATE POLICY "Users can delete own flight photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'flight-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies: igc-files
CREATE POLICY "Authenticated users can upload igc files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'igc-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view own igc files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'igc-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own igc files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'igc-files' AND auth.uid()::text = (storage.foldername(name))[1]);
