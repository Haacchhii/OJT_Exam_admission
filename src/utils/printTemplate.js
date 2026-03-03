import { SCHOOL_NAME, SCHOOL_ADDRESS, SCHOOL_PHONE, SCHOOL_YEAR } from './constants.js';

/**
 * Shared print template for opening a styled print window.
 * Used by employee/Admissions, employee/Results, and student/Results pages.
 */
export function openPrintWindow({ title, subtitle, bodyHtml }) {
  const printStyles = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; padding: 30px; color: #1e293b; }
    .logo { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #166534; padding-bottom: 16px; }
    .logo span { font-size: 36px; }
    .logo h1 { font-size: 18px; color: #166534; margin-top: 8px; }
    .logo .subtitle { font-size: 12px; color: #666; margin-top: 4px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 20px; }
    .field label { display: block; font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 0.5px; }
    .field span { display: block; font-size: 14px; font-weight: 600; color: #1e293b; margin-top: 2px; }
    .result-badge { display: inline-block; padding: 6px 16px; border-radius: 20px; font-weight: 700; font-size: 14px; margin-top: 12px; }
    .result-badge.passed { background: #dcfce7; color: #166534; }
    .result-badge.failed { background: #fef2f2; color: #dc2626; }
    .score-circle { width: 100px; height: 100px; border-radius: 50%; border: 4px solid #166534; display: flex; align-items: center; justify-content: center; margin: 16px auto; }
    .score-circle span { font-size: 24px; font-weight: 800; color: #166534; }
    .section-title { font-size: 14px; font-weight: 700; color: #166534; margin-top: 20px; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
    .doc-list { list-style: none; padding: 0; }
    .doc-list li { padding: 4px 0; font-size: 13px; border-bottom: 1px solid #f3f4f6; }
    .doc-list li::before { content: "✓ "; color: #166534; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { text-align: left; padding: 6px 8px; font-size: 12px; border-bottom: 1px solid #e5e7eb; }
    th { color: #6b7280; text-transform: uppercase; font-size: 10px; }
    .footer { margin-top: 30px; font-size: 11px; color: #aaa; text-align: center; }
    @media print { body { padding: 15px; } }
  `;

  const w = window.open('', '_blank', 'width=800,height=600');
  w.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>${printStyles}</style></head><body>`);
  w.document.write(`<div class="logo"><span>🔑</span><h1>${SCHOOL_NAME}</h1><p class="subtitle">${SCHOOL_ADDRESS} &bull; Tel: ${SCHOOL_PHONE}<br/>${subtitle}</p></div>`);
  w.document.write(bodyHtml);
  w.document.write(`<p class="footer">Printed on ${new Date().toLocaleDateString()} — ${SCHOOL_NAME} &copy; ${SCHOOL_YEAR}</p>`);
  w.document.write('</body></html>');
  w.document.close();
  w.print();
}
