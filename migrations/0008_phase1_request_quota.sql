-- SG-001: supports the atomic rolling request quota lookup.
-- This migration is additive and can be kept if quota policies evolve later.
CREATE INDEX IF NOT EXISTS service_requests_requester_created_idx
ON service_requests(requester_id, created_at DESC);
