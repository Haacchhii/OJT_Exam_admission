#!/usr/bin/env node
import { setTimeout as wait } from 'timers/promises';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const intervalMs = Number(process.env.SUMMARY_REFRESH_INTERVAL_MS) || 5 * 60 * 1000; // default 5 minutes

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
    await wait(intervalMs);
  }
}

// Allow one-off run with env RUN_ONCE=1
if (process.env.RUN_ONCE === '1') {
  await runOnce();
  process.exit(0);
} else {
  console.log('Starting employee-summary refresh worker, intervalMs=', intervalMs);
  await loop();
}
