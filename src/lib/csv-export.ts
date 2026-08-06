import { Platform } from 'react-native';

function escapeCsvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function rowsToCsv(rows: string[][]): string {
  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n');
}

// Triggers a browser file download for the given CSV rows. Web-only (matches this app's
// existing PDF-to-slides pattern) — there's no file-picker/share-sheet story for native yet,
// so this is a silent no-op there rather than a half-built download experience.
export function downloadCsv(filename: string, rows: string[][]) {
  if (Platform.OS !== 'web') return;

  const csv = rowsToCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
