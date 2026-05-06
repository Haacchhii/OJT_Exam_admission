#!/usr/bin/env node
import { setTimeout as wait } from 'timers/promises';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIN_INTERVAL_MS = 60 * 1000;
const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
const rawIntervalMs = Number(process.env.SUMMARY_REFRESH_INTERVAL_MS) || DEFAULT_INTERVAL_MS;
const intervalMs = Math.max(MIN_INTERVAL_MS, rawIntervalMs);
const jitterPercent = Math.max(0, Math.min(50, Number(process.env.SUMMARY_REFRESH_JITTER_PERCENT) || 10));

function computeWaitMs(baseMs) {
  const spread = Math.floor((baseMs * jitterPercent) / 100);
  const delta = spread > 0 ? Math.floor(Math.random() * (2 * spread + 1)) - spread : 0;
  return Math.max(MIN_INTERVAL_MS, baseMs + delta);
}

async function runOnce() {
  try {
    console.log(new Date().toISOString(), 'Running employee-summary refresh once...');
    // spawn the refresh script as a child process to keep worker simple and resilient
    const { spawn } = await import('child_process');
    const child = spawn(process.execPath, [path.join(__dirname, 'refresh-employee-summary.mjs')], { stdio: 'inherit' });
    await new Promise((resolve, reject) => {
      child.on('exit', (code) => code === 0 ? resolve() : reject(new Error('refresh script exited ' + code)));
    });
  } catch (err) {
    console.error('Refresh worker runOnce failed:', err?.message || err);
  }
}

async function loop() {
  while (true) {
    await runOnce();
    await wait(computeWaitMs(intervalMs));
  }
}

// Allow one-off run with env RUN_ONCE=1
if (process.env.RUN_ONCE === '1') {
  await runOnce();
  process.exit(0);
} else {
  console.log('Starting employee-summary refresh worker, intervalMs=', intervalMs, 'jitterPercent=', jitterPercent);
  await loop();
}
