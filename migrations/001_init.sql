-- SilverCare Home Hub schema

CREATE TABLE IF NOT EXISTS centers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  district TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS elderly_clients (
  id TEXT PRIMARY KEY,
  center_id TEXT NOT NULL REFERENCES centers(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  district TEXT NOT NULL,
  address TEXT NOT NULL,
  notes TEXT DEFAULT '',
  emergency_contact TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS caregivers (
  id TEXT PRIMARY KEY,
  center_id TEXT NOT NULL REFERENCES centers(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  district TEXT NOT NULL,
  skills TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  max_daily_jobs INT NOT NULL DEFAULT 6,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_types (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name_zh TEXT NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 60,
  required_skills TEXT[] NOT NULL DEFAULT '{}',
  description TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS availability (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL REFERENCES caregivers(id) ON DELETE CASCADE,
  weekday INT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  center_id TEXT NOT NULL REFERENCES centers(id),
  client_id TEXT NOT NULL REFERENCES elderly_clients(id),
  service_type_id TEXT NOT NULL REFERENCES service_types(id),
  requested_start TIMESTAMPTZ NOT NULL,
  requested_end TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  -- pending | assigned | accepted | en_route | in_progress | completed | cancelled
  notes TEXT DEFAULT '',
  channel TEXT NOT NULL DEFAULT 'web',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  caregiver_id TEXT NOT NULL REFERENCES caregivers(id),
  score NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'offered',
  -- offered | accepted | declined | in_progress | completed
  offered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  check_in_at TIMESTAMPTZ,
  check_out_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS channel_identities (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL,
  external_id TEXT NOT NULL,
  role TEXT NOT NULL,
  -- family | caregiver | staff
  ref_id TEXT,
  display_name TEXT,
  UNIQUE (channel, external_id)
);

CREATE TABLE IF NOT EXISTS chat_sessions (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL,
  external_id TEXT NOT NULL,
  role TEXT,
  ref_id TEXT,
  context_json TEXT NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (channel, external_id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  direction TEXT NOT NULL,
  -- inbound | outbound
  body TEXT NOT NULL,
  meta_json TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor TEXT,
  action TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_start ON bookings(requested_start);
CREATE INDEX IF NOT EXISTS idx_caregivers_center ON caregivers(center_id);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON elderly_clients(phone);
CREATE INDEX IF NOT EXISTS idx_caregivers_phone ON caregivers(phone);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, created_at);
