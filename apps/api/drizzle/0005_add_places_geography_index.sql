CREATE INDEX "places_location_geography_gist_idx" ON "places" USING gist (("location"::geography));
