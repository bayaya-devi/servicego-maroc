CREATE INDEX IF NOT EXISTS service_requests_geo_search_idx
ON service_requests(status, category_id, latitude, longitude, created_at DESC);

CREATE INDEX IF NOT EXISTS user_services_geo_search_idx
ON user_services(available, category_id, latitude, longitude, created_at DESC);
