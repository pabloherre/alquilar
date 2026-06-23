import dayjs from 'dayjs';

export function formatDateDisplay(value) {
  if (!value) return '-';
  return dayjs(value).format('DD/MM/YYYY');
}

export function formatCompactNumber(value) {
  const n = Number(value || 0);
  const abs = Math.abs(n);

  if (abs >= 1000000) {
    const v = (n / 1000000).toFixed(1).replace(/\.0$/, '');
    return `${v}M`;
  }

  if (abs >= 1000) {
    const v = (n / 1000).toFixed(1).replace(/\.0$/, '');
    return `${v}k`;
  }

  return n.toFixed(0);
}

export function formatCompactMoney(value, currency = 'ARS') {
  return `${currency} ${formatCompactNumber(value)}`;
}

export function formatMonthYearDisplay(value) {
  if (!value) return '-';

  const raw = String(value);
  const directMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  if (directMatch) {
    const year = Number(directMatch[1]);
    const month = Number(directMatch[2]);
    if (month >= 1 && month <= 12) return `${monthNames[month - 1]} ${year}`;
  }

  const parsed = dayjs(value);
  if (!parsed.isValid()) return '-';
  const month = monthNames[parsed.month()];
  return `${month} ${parsed.year()}`;
}
export function formatMoneyNoDecimals(value, currency = 'ARS') {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
    minimumFractionDigits: 0
  }).format(amount);
}
