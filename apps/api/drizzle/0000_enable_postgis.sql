-- PostGIS is required by every environment before spatial tables are created.
-- IF NOT EXISTS keeps this migration compatible with providers/images that
-- pre-enable the extension during database initialization.
CREATE EXTENSION IF NOT EXISTS postgis;
