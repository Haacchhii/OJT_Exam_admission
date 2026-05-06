Deployment notes — Redis & employee-summary worker

- To enable Redis caching (shared across instances):
  - Set `ENABLE_REDIS_CACHE=1` and `REDIS_URL` (Upstash or self-hosted)
  - Optionally tune `REDIS_CONNECT_TIMEOUT_MS` (ms)

- Materialized summary (fast reads):
  - `USE_MATERIALIZED_SUMMARY=1` will cause `/api/results/employee-summary` to use `employee_summary_mv` when present.
  - To create and populate the materialized view, run:
    ```powershell
    node scripts/refresh-employee-summary.mjs
    ```
  - To keep it fresh, run the worker in background (PM2/systemd/container sidecar):
    ```powershell
    npm run worker:refresh-summary
    ```
  - Default refresh interval is 5 minutes (`SUMMARY_REFRESH_INTERVAL_MS`).

- Cache TTL: `SUMMARY_CACHE_MS` (default 300000 ms = 5 minutes). When the materialized view is refreshed the worker invalidates cached `resultsEmployeeSummary*` keys.

- Production tips:
  - Run the refresh worker on a schedule or as a single sidecar per deployment to avoid MV refresh contention.
  - Confirm `CREATE UNIQUE INDEX idx_employee_summary_mv_result_id ON employee_summary_mv(result_id);` exists to allow concurrent MV refreshes.
  - Ensure `DATABASE_URL` and `REDIS_URL` are set in the environment used by the worker.
