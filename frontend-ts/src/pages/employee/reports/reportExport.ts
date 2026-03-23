import { SCHOOL_NAME } from '../../../utils/constants';

export interface PdfSection {
  subtitle: string;
  chartSvg?: string;
  headers: string[];
  rows: (string | number)[][];
}

function escapeHtml(value: string | number) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderTableHtml(headers: string[], rows: (string | number)[][]) {
  const ths = headers
    .map(h => `<th style="border:1px solid #ccc;padding:6px 10px;background:#f5f5f0;font-size:12px;text-align:left">${escapeHtml(h)}</th>`)
    .join('');
  const trs = rows
    .map(r => `<tr>${r.map(c => `<td style="border:1px solid #ddd;padding:5px 10px;font-size:11px">${escapeHtml(c)}</td>`).join('')}</tr>`)
    .join('');
  return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
}

export function buildActiveFilters(filters: {
  statusFilter: string;
  levelGroupFilter: string;
  gradeFilter: string;
  yearFilter: string;
  semesterFilter: string;
  dateFrom: string;
  dateTo: string;
}) {
  return [
    filters.statusFilter !== 'all' ? `Status: ${filters.statusFilter}` : '',
    filters.levelGroupFilter !== 'all' ? `Level Group: ${filters.levelGroupFilter}` : '',
    filters.gradeFilter !== 'all' ? `Grade: ${filters.gradeFilter}` : '',
    filters.yearFilter !== 'all' ? `School Year ID: ${filters.yearFilter}` : '',
    filters.semesterFilter !== 'all' ? `Semester ID: ${filters.semesterFilter}` : '',
    filters.dateFrom ? `From: ${filters.dateFrom}` : '',
    filters.dateTo ? `To: ${filters.dateTo}` : '',
  ].filter(Boolean);
}

export function downloadCSV(filename: string, rows: (string | number)[][]) {
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function getChartSvgMarkup(containerId: string) {
  const container = document.getElementById(containerId);
  if (!container) return '';
  const svg = container.querySelector('svg');
  if (!svg) return '';
  return svg.outerHTML;
}

export function printPdfReport(
  title: string,
  sections: PdfSection[],
  activeFilters: string[],
  onPopupBlocked: () => void
) {
  const w = window.open('', '_blank');
  if (!w) {
    onPopupBlocked();
    return;
  }

  const sectionsHtml = sections
    .map(section => {
      const chartBlock = section.chartSvg
        ? `<div style="margin:8px 0 10px;border:1px solid #e5e7eb;border-radius:8px;padding:8px;background:#ffffff">${section.chartSvg}</div>`
        : '';
      return `
      <section style="margin-top:18px;break-inside:avoid">
        <h2 style="font-size:14px;color:#1a3c2a;margin:0 0 6px">${escapeHtml(section.subtitle)}</h2>
        ${chartBlock}
        ${renderTableHtml(section.headers, section.rows)}
      </section>
    `;
    })
    .join('');

  const filtersHtml = activeFilters.length
    ? activeFilters
        .map(f => `<span style="display:inline-block;border:1px solid #d1d5db;border-radius:999px;padding:3px 8px;margin:0 6px 6px 0;font-size:11px;color:#4b5563">${escapeHtml(f)}</span>`)
        .join('')
    : '<span style="font-size:11px;color:#6b7280">No filters applied (showing all data)</span>';

  const totalRows = sections.reduce((sum, s) => sum + s.rows.length, 0);

  w.document.write(`<!DOCTYPE html><html><head><title>${escapeHtml(title)}</title><style>@page{size:landscape;margin:1cm}body{font-family:system-ui,sans-serif;padding:20px}h1{font-size:18px;color:#1a3c2a;margin:0 0 6px}table{width:100%;border-collapse:collapse;margin-top:10px}p.meta{color:#888;font-size:11px;margin:0 0 10px}.meta-row{display:flex;gap:18px;flex-wrap:wrap;margin-bottom:6px}.meta-item{font-size:11px;color:#6b7280}</style></head><body><h1>${escapeHtml(SCHOOL_NAME)} - ${escapeHtml(title)}</h1><div class="meta-row"><span class="meta-item">Generated on ${escapeHtml(new Date().toLocaleString())}</span><span class="meta-item">Total rows exported: ${totalRows}</span></div><p class="meta" style="margin-bottom:4px">Applied Filters</p><div style="margin-bottom:8px">${filtersHtml}</div>${sectionsHtml}</body></html>`);
  w.document.close();
  w.onafterprint = () => w.close();
  setTimeout(() => w.print(), 400);
}
