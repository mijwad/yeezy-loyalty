// CSV Export Utility
import { showToast } from './toast.js';

export function exportToCSV(filename, rows) {
  const processRow = function (row) {
    return row.map(val => `"${(val ?? '').toString().replace(/"/g, '""')}"`).join(',');
  };
  const csvFile = rows.map(processRow).join('\n');
  const blob = new Blob([csvFile], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast(`Exported ${filename}`);
}
