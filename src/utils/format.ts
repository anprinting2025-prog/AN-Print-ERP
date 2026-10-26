// Format Algerian Dinar Currency
export const formatDZD = (amount: number | string | undefined | null): string => {
  const val = typeof amount === 'string' ? parseFloat(amount) : (amount || 0);
  if (isNaN(val)) return '0.00 DA';
  return new Intl.NumberFormat('fr-DZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val) + ' DA';
};

// Format Date as DD/MM/YYYY
export const formatDate = (dateStr: string | undefined | null): string => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      // If it's already YYYY-MM-DD
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return dateStr;
    }
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
};

// CSV Export Helper
export const exportToCSV = (filename: string, rows: Record<string, any>[]) => {
  if (!rows || !rows.length) return;
  const separator = ',';
  const keys = Object.keys(rows[0]);
  const csvContent =
    keys.join(separator) +
    '\n' +
    rows
      .map((row) =>
        keys
          .map((k) => {
            let cell = row[k] === null || row[k] === undefined ? '' : row[k];
            cell = cell instanceof Date ? cell.toLocaleString() : cell.toString();
            cell = cell.replace(/"/g, '""');
            if (cell.search(/("|,|\n)/g) >= 0) cell = `"${cell}"`;
            return cell;
          })
          .join(separator)
      )
      .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Normalize Algerian phone number to international format (213XXXXXXXXX)
export const normalizeAlgerianPhone = (phone?: string): string => {
  if (!phone) return '';
  const cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('213')) return cleaned;
  if (cleaned.startsWith('0')) return '213' + cleaned.substring(1);
  return '213' + cleaned;
};

// Generate WhatsApp direct URL with optional message
export const getWhatsAppUrl = (phone?: string, text?: string): string => {
  const norm = normalizeAlgerianPhone(phone);
  const encodedText = text ? encodeURIComponent(text) : '';
  if (!norm) {
    return encodedText ? `https://wa.me/?text=${encodedText}` : 'https://wa.me/';
  }
  return `https://wa.me/${norm}${encodedText ? `?text=${encodedText}` : ''}`;
};

