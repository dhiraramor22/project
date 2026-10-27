import { describe, expect, it, vi } from 'vitest';
import writeXlsxFile from 'write-excel-file';
import { buildCsv, downloadCsv, downloadXlsx, printTable } from '../src/utils/export';

vi.mock('write-excel-file', () => ({
  default: vi.fn(async () => undefined),
}));

describe('CSV export', () => {
  it('writes a UTF-8 BOM, CRLF rows and escapes commas, quotes and newlines', () => {
    const csv = buildCsv(
      ['Name', 'Note', 'Area'],
      [
        ['Oasis, Benali', 'He said "hello"', 2.5],
        ['Line\nbreak', null, 0],
      ],
    );

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('Name,Note,Area\r\n');
    expect(csv).toContain('"Oasis, Benali","He said ""hello""",2.5\r\n');
    expect(csv).toContain('"Line\nbreak",,0\r\n');
    expect(csv.endsWith('\r\n')).toBe(true);
  });

  it('downloads CSV through a Blob URL and keeps the file extension', () => {
    const createObjectURL = vi.fn(() => 'blob:test');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadCsv('treatments', ['ID'], [['TRT-1']]);

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    click.mockRestore();
  });
});

describe('XLSX export', () => {
  it('delegates to write-excel-file with a bold header row', async () => {
    await downloadXlsx('report', 'Report', ['Name', 'Area'], [['Oasis', 2]]);

    const mock = vi.mocked(writeXlsxFile);
    expect(mock).toHaveBeenCalledTimes(1);
    const [data, options] = mock.mock.calls[0]!;
    expect(options).toMatchObject({ fileName: 'report.xlsx', sheet: 'Report' });
    expect(data[0]?.[0]).toMatchObject({ value: 'Name', fontWeight: 'bold' });
    expect(data[1]?.[1]).toMatchObject({ value: 2, type: Number });
  });
});

describe('print export', () => {
  it('renders an escaped, RTL-aware printable table', () => {
    const write = vi.fn();
    const close = vi.fn();
    const fakePopup = {
      document: { write, close },
    } as unknown as Window;
    const open = vi.spyOn(window, 'open').mockReturnValue(fakePopup);

    const ok = printTable({
      title: 'تقرير <المبيدات>',
      subtitle: 'El Oued',
      meta: ['Generated: 2026-03-15'],
      headers: ['Name', 'Area'],
      rows: [['<script>alert(1)</script>', 2]],
      notice: 'Provisional / Demo methodology',
      direction: 'rtl',
      language: 'ar',
    });

    expect(ok).toBe(true);
    expect(open).toHaveBeenCalledWith('', '_blank', 'width=1024,height=768');
    expect(write).toHaveBeenCalledTimes(1);
    const html = String(write.mock.calls[0]?.[0] ?? '');
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('lang="ar"');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('Provisional / Demo methodology');
    expect(close).toHaveBeenCalledTimes(1);
    open.mockRestore();
  });

  it('returns false when the print window is blocked', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    expect(printTable({ title: 'Blocked', headers: ['A'], rows: [] })).toBe(false);
    open.mockRestore();
  });
});
