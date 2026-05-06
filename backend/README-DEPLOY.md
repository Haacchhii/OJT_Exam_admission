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

Production scheduler options (pick one)

- PM2 (persistent worker loop):
  - Config file: `deploy/pm2/ecosystem.worker-refresh.cjs`
  - Start command:
    ```bash
    pm2 start deploy/pm2/ecosystem.worker-refresh.cjs
    pm2 save
    pm2 startup
    ```

- systemd timer (scheduled one-shot every 5 minutes):
  - Unit files:
    - `deploy/systemd/employee-summary-refresh.service`
    - `deploy/systemd/employee-summary-refresh.timer`
  - Install commands:
    ```bash
    sudo cp deploy/systemd/employee-summary-refresh.service /etc/systemd/system/
    sudo cp deploy/systemd/employee-summary-refresh.timer /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable --now employee-summary-refresh.timer
    sudo systemctl status employee-summary-refresh.timer
    ```

- Kubernetes CronJob (scheduled every 5 minutes):
  - Manifest: `deploy/k8s/employee-summary-refresh-cronjob.yaml`
  - Apply:
    ```bash
    kubectl apply -f deploy/k8s/employee-summary-refresh-cronjob.yaml
    ```

Load and cost impact

- Default cadence is every 5 minutes, which is usually low impact for small-to-medium datasets.
- Each run performs one materialized view refresh plus index maintenance checks and cache invalidation.
- A PostgreSQL advisory lock is used to prevent duplicate concurrent refreshes across multiple workers.
- For Kubernetes, `concurrencyPolicy: Forbid` prevents overlapping jobs.
- If you want lower cost/traffic, increase `SUMMARY_REFRESH_INTERVAL_MS` to `600000` (10 minutes) or `900000` (15 minutes).
- Recommended start point:
  - `SUMMARY_REFRESH_INTERVAL_MS=300000`
  - `SUMMARY_REFRESH_JITTER_PERCENT=10`
  - Keep exactly one scheduler mode active (PM2 or systemd timer or K8s CronJob).
