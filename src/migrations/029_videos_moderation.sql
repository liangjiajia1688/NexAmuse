-- 029: Video moderation + source tag
-- Add a `source` column so we can tell manually-pasted links apart from
-- auto-aggregated (YouTube Data API) videos. status gains two new values:
--   pending  -> fetched by the daily aggregator, waiting for admin review
--   rejected -> admin rejected an auto-fetched / submitted video
-- The public Videos page only displays status='active'.

ALTER TABLE videos ADD COLUMN source TEXT DEFAULT 'manual';  -- manual | youtube_api

CREATE INDEX IF NOT EXISTS idx_videos_status_source ON videos(status, source);
