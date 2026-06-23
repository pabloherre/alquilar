import dayjs from 'dayjs';

export function startOfMonth(date) {
  return dayjs(date).startOf('month').toDate();
}

export function addMonths(date, months) {
  return dayjs(date).add(months, 'month').toDate();
}

export function addYears(date, years) {
  return dayjs(date).add(years, 'year').toDate();
}

export function roundUsd(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function yearMonthParts(year, month) {
  const y = Number(year);
  const m = Number(month);
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) {
    throw new Error('Invalid year/month');
  }
  return { y, m };
}