import writeXlsxFile from 'write-excel-file';

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export function buildCsv(headers: string[], rows: Array<Array<string | number | null>>): string {
  const lines = [headers.map(escapeCsvCell).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCsvCell).join(','));
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export function downloadCsv(
  fileName: string,
  headers: string[],
  rows: Array<Array<string | number | null>>,
): void {
  const blob = new Blob([buildCsv(headers, rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

export async function downloadXlsx(
  fileName: string,
  sheetName: string,
  headers: string[],
  rows: Array<Array<string | number | null>>,
): Promise<void> {
  const data = [
    headers.map((header) => ({
      value: header,
      fontWeight: 'bold' as const,
      backgroundColor: '#E1F2E8',
    })),
    ...rows.map((row) =>
      row.map((cell) => {
        if (cell === null || cell === undefined) return null;
        if (typeof cell === 'number') return { value: cell, type: Number };
        return { value: String(cell) };
      }),
    ),
  ];
  await writeXlsxFile(data, {
    fileName: fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`,
    sheet: sheetName,
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export interface PrintOptions {
  title: string;
  subtitle?: string;
  meta?: string[];
  headers: string[];
  rows: Array<Array<string | number | null>>;
  notice?: string;
  direction?: 'ltr' | 'rtl';
  language?: string;
}

export function printTable({
  title,
  subtitle,
  meta = [],
  headers,
  rows,
  notice,
  direction = 'ltr',
  language = 'en',
}: PrintOptions): boolean {
  const popup = window.open('', '_blank', 'width=1024,height=768');
  if (!popup) return false;
  const metaHtml = meta.length
    ? `<div class="meta">${meta.map((item) => `<p>${escapeHtml(item)}</p>`).join('')}</div>`
    : '';
  const bodyRows = rows
    .map(
      (row) =>
        `<tr>${row
          .map((cell) => `<td>${cell === null || cell === undefined ? '' : escapeHtml(String(cell))}</td>`)
          .join('')}</tr>`,
    )
    .join('');
  popup.document.write(`<!doctype html>
<html lang="${escapeHtml(language)}" dir="${direction}">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Tahoma, Arial, sans-serif; color: #1f2723; margin: 28px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 15px; font-weight: 600; margin: 0 0 14px; color: #516159; }
  .meta { margin-bottom: 12px; font-size: 11px; color: #516159; }
  .meta p { margin: 2px 0; }
  .notice { border: 1px solid #eae1c9; background: #fbf9f3; padding: 8px 10px; font-size: 10.5px; margin-bottom: 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
  thead { display: table-header-group; }
  th, td { border: 1px solid #d5dad7; padding: 5px 6px; text-align: start; vertical-align: top; }
  th { background: #e1f2e8; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
  tr { break-inside: avoid; }
  .footer { margin-top: 12px; font-size: 10px; color: #677a70; }
  @page { size: A4 landscape; margin: 12mm; }
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <h2>${escapeHtml(subtitle ?? '')}</h2>
  ${metaHtml}
  ${notice ? `<div class="notice">${escapeHtml(notice)}</div>` : ''}
  <table>
    <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
  <p class="footer">El Oued Pesticide Management Platform — local demonstration prototype.</p>
  <script>window.onload = function () { window.print(); };</script>
</body>
</html>`);
  popup.document.close();
  return true;
}

export function isoDate(value: Date = new Date()): string {
  return value.toISOString().slice(0, 10);
}

export function fileStamp(value: Date = new Date()): string {
  return value.toISOString().replace(/[:.]/g, '-');
}
