CREATE TABLE IF NOT EXISTS users (
  id              SERIAL PRIMARY KEY,
  email           VARCHAR(255) UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL DEFAULT '',
  role            VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('owner', 'admin', 'user')),
  status          VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned')),
  google_id       VARCHAR(255),
  provider        VARCHAR(20) NOT NULL DEFAULT 'local',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS devices (
  id                  SERIAL PRIMARY KEY,
  device_id           VARCHAR(255) UNIQUE NOT NULL,
  name                VARCHAR(255) NOT NULL,
  owner_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  registered_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen           TIMESTAMPTZ,
  last_lat            DOUBLE PRECISION,
  last_lng            DOUBLE PRECISION,
  last_ph             DOUBLE PRECISION,
  last_temperature    DOUBLE PRECISION,
  last_turbidity      DOUBLE PRECISION,
  last_conductivity   DOUBLE PRECISION,
  status              VARCHAR(20) NOT NULL DEFAULT 'disconnected'
);

CREATE TABLE IF NOT EXISTS sensor_readings (
  id              SERIAL PRIMARY KEY,
  device_id       INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  ph              DOUBLE PRECISION,
  temperature     DOUBLE PRECISION,
  turbidity       DOUBLE PRECISION,
  conductivity    DOUBLE PRECISION,
  latitude        DOUBLE PRECISION,
  longitude       DOUBLE PRECISION,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS active_alerts (
  id              VARCHAR(255) PRIMARY KEY,
  device_id       INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  parameter       VARCHAR(50),
  alert_type      VARCHAR(50),
  value           DOUBLE PRECISION,
  threshold       DOUBLE PRECISION,
  severity        VARCHAR(20),
  message         TEXT,
  resolved        BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tickets (
  id                      SERIAL PRIMARY KEY,
  user_id                 INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject                 VARCHAR(500) NOT NULL,
  description             TEXT NOT NULL,
  priority                VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status                  VARCHAR(30) NOT NULL DEFAULT 'open',
  created_by_role         VARCHAR(20),
  assigned_to             INTEGER REFERENCES users(id) ON DELETE SET NULL,
  closure_proposed_at     TIMESTAMPTZ,
  closure_proposed_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  closed_at               TIMESTAMPTZ,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id          SERIAL PRIMARY KEY,
  ticket_id   INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  sender_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
