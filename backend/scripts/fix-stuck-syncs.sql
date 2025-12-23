-- Check for stuck syncs (running for more than 30 minutes)
SELECT
  id,
  tenant_id,
  status,
  sync_type,
  started_at,
  EXTRACT(EPOCH FROM (NOW() - started_at))/60 as minutes_running
FROM sync_history
WHERE status IN ('running', 'pending')
  AND started_at < NOW() - INTERVAL '30 minutes'
ORDER BY started_at DESC;

-- To fix stuck syncs, uncomment and run this:
-- UPDATE sync_history
-- SET
--   status = 'failed',
--   completed_at = NOW(),
--   error_message = 'Sync timed out - exceeded maximum duration'
-- WHERE status IN ('running', 'pending')
--   AND started_at < NOW() - INTERVAL '30 minutes';
