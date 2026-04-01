import fs from 'node:fs';
import path from 'node:path';

const assetsDir = path.resolve(process.cwd(), 'dist', 'assets');

if (!fs.existsSync(assetsDir)) {
  console.error('[bundle-budget] dist/assets not found. Run `npm run build` first.');
  process.exit(1);
}

const files = fs.readdirSync(assetsDir).filter((file) => file.endsWith('.js'));
const chunks = files.map((file) => {
  const fullPath = path.join(assetsDir, file);
  const sizeBytes = fs.statSync(fullPath).size;
  return { file, sizeBytes, sizeKb: sizeBytes / 1024 };
});

const budgets = [
  { name: 'app entry', pattern: /^index-.*\.js$/, maxKb: 170, required: true },
  { name: 'core vendor', pattern: /^vendor-.*\.js$/, maxKb: 220, required: true },
  { name: 'reports route', pattern: /^Reports-.*\.js$/, maxKb: 30, required: true },
  { name: 'reports charts bundle', pattern: /^reports-charts-.*\.js$/, maxKb: 40, required: true },
  { name: 'exam builder route', pattern: /^ExamBuilder-.*\.js$/, maxKb: 60, required: true },
  { name: 'charts vendor', pattern: /^charts-vendor-.*\.js$/, maxKb: 420, required: true },
  { name: 'exam IO vendor', pattern: /^exam-io-vendor-.*\.js$/, maxKb: 500, required: true },
];

const failures = [];

for (const budget of budgets) {
  const matches = chunks.filter((chunk) => budget.pattern.test(chunk.file));

  if (matches.length === 0) {
    if (budget.required) {
      failures.push(`Missing required chunk for ${budget.name} (${budget.pattern})`);
    }
    continue;
  }

  const largest = matches.reduce((max, chunk) => (chunk.sizeKb > max.sizeKb ? chunk : max), matches[0]);
  if (largest.sizeKb > budget.maxKb) {
    failures.push(
      `${budget.name} exceeds budget: ${largest.file} is ${largest.sizeKb.toFixed(2)} KB (max ${budget.maxKb} KB)`
    );
  }
}

const totalJsKb = chunks.reduce((sum, chunk) => sum + chunk.sizeKb, 0);
const totalJsBudgetKb = 1800;
if (totalJsKb > totalJsBudgetKb) {
  failures.push(`Total JS exceeds budget: ${totalJsKb.toFixed(2)} KB (max ${totalJsBudgetKb} KB)`);
}

const largestChunks = [...chunks].sort((a, b) => b.sizeKb - a.sizeKb).slice(0, 10);

console.log('[bundle-budget] Largest JS chunks:');
for (const chunk of largestChunks) {
  console.log(` - ${chunk.file}: ${chunk.sizeKb.toFixed(2)} KB`);
}
console.log(`[bundle-budget] Total JS: ${totalJsKb.toFixed(2)} KB`);

if (failures.length > 0) {
  console.error('[bundle-budget] Budget check failed:');
  for (const failure of failures) {
    console.error(` - ${failure}`);
  }
  process.exit(1);
}

console.log('[bundle-budget] All bundle budgets passed.');
