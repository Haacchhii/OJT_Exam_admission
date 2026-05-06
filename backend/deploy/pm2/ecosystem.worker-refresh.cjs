module.exports = {
  apps: [
    {
      name: 'gk-worker-refresh-summary',
      cwd: '/opt/golden/backend',
      script: 'scripts/worker-refresh-loop.mjs',
      node_args: '--enable-source-maps',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 20,
      restart_delay: 5000,
      kill_timeout: 15000,
      env: {
        NODE_ENV: 'production',
        USE_MATERIALIZED_SUMMARY: '1',
        SUMMARY_REFRESH_INTERVAL_MS: '300000',
        SUMMARY_REFRESH_JITTER_PERCENT: '10'
      }
    }
  ]
};
