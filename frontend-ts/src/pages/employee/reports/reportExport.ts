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
    .map(h => `<th style="border:1px solid #dbe3ea;padding:7px 9px;background:#eef4f8;font-size:11px;text-align:left;color:#1f2937;white-space:nowrap">${escapeHtml(h)}</th>`)
    .join('');
  const trs = rows
    .map(r => `<tr>${r.map(c => `<td style="border:1px solid #e5e7eb;padding:5px 8px;font-size:10px;color:#374151;vertical-align:top;word-break:break-word;line-height:1.35">${escapeHtml(c)}</td>`).join('')}</tr>`)
    .join('');
  return `<table style="width:100%;border-collapse:collapse;table-layout:fixed"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
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

  // Prefer the actual Recharts surface to avoid picking decorative icon SVGs.
  const chartSvg = container.querySelector('.recharts-wrapper svg.recharts-surface');
  if (chartSvg) return chartSvg.outerHTML;

  // Fallback: choose the largest SVG in the container, which is typically the chart.
  const svgs = Array.from(container.querySelectorAll('svg'));
  if (!svgs.length) return '';

  const best = svgs
    .map((svg) => {
      const widthAttr = Number(svg.getAttribute('width') || 0);
      const heightAttr = Number(svg.getAttribute('height') || 0);
      const rect = svg.getBoundingClientRect();
      const width = Number.isFinite(widthAttr) && widthAttr > 0 ? widthAttr : rect.width;
      const height = Number.isFinite(heightAttr) && heightAttr > 0 ? heightAttr : rect.height;
      return { svg, area: width * height };
    })
    .sort((a, b) => b.area - a.area)[0];

  return best?.svg?.outerHTML || '';
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
        ? `<div style="margin:10px 0 12px;border:1px solid #dbe3ea;border-radius:10px;padding:10px;background:#ffffff">${section.chartSvg}</div>`
        : '';
      return `
      <section style="margin-top:16px;break-inside:avoid;page-break-inside:avoid">
        <h2 style="font-size:13px;color:#0f172a;margin:0 0 6px;font-weight:700">${escapeHtml(section.subtitle)}</h2>
        ${chartBlock}
        ${renderTableHtml(section.headers, section.rows)}
      </section>
    `;
    })
    .join('');

  const filtersHtml = activeFilters.length
    ? activeFilters
        .map(f => `<span style="display:inline-block;border:1px solid #d1d5db;border-radius:999px;padding:2px 8px;margin:0 6px 6px 0;font-size:10px;color:#4b5563;background:#f9fafb">${escapeHtml(f)}</span>`)
        .join('')
    : '<span style="font-size:11px;color:#6b7280">No filters applied (showing all data)</span>';

  const totalRows = sections.reduce((sum, s) => sum + s.rows.length, 0);

  w.document.write(`<!DOCTYPE html><html><head><title>${escapeHtml(title)}</title><style>@page{size:landscape;margin:10mm}body{font-family:Arial,Helvetica,sans-serif;margin:0;color:#0f172a}.sheet{padding:16px 20px}header.report{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;padding-bottom:10px;border-bottom:2px solid #1f4f73}.brand{display:flex;flex-direction:column}.school{font-size:18px;font-weight:700;line-height:1.2;color:#0f172a}.title{font-size:13px;font-weight:600;color:#1f4f73;margin-top:2px}.meta-col{display:flex;flex-direction:column;gap:2px;text-align:right}.meta-item{font-size:10px;color:#475569}.filters{margin:10px 0 4px}.filters-label{font-size:10px;font-weight:700;color:#475569;margin-bottom:4px;text-transform:uppercase;letter-spacing:.04em}</style></head><body><div class="sheet"><header class="report"><div class="brand"><div class="school">${escapeHtml(SCHOOL_NAME)}</div><div class="title">${escapeHtml(title)}</div></div><div class="meta-col"><span class="meta-item">Generated: ${escapeHtml(new Date().toLocaleString())}</span><span class="meta-item">Rows exported: ${totalRows}</span></div></header><div class="filters"><div class="filters-label">Applied Filters</div><div>${filtersHtml}</div></div>${sectionsHtml}</div></body></html>`);
  w.document.close();
  w.onafterprint = () => w.close();
  setTimeout(() => w.print(), 400);
}
