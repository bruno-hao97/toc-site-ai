-- Meta for per-user platform library (prompt / ratio / resolution)
ALTER TABLE platform_jobs
  ADD COLUMN prompt TEXT NULL AFTER result_url,
  ADD COLUMN meta_json JSON NULL AFTER prompt;
