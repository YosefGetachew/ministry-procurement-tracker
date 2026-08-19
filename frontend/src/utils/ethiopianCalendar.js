const ETHIOPIAN_EPOCH_JDN = 1724221;

function pad(value) {
  return String(value).padStart(2, '0');
}

function gregorianToJdn(year, month, day) {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + (12 * a) - 3;
  return day + Math.floor(((153 * m) + 2) / 5) + (365 * y)
    + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

function jdnToGregorian(jdn) {
  const a = jdn + 32044;
  const b = Math.floor(((4 * a) + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor(((4 * c) + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor(((5 * e) + 2) / 153);
  return {
    day: e - Math.floor(((153 * m) + 2) / 5) + 1,
    month: m + 3 - (12 * Math.floor(m / 10)),
    year: (100 * b) + d - 4800 + Math.floor(m / 10),
  };
}

function ethiopianToJdn(year, month, day) {
  return ETHIOPIAN_EPOCH_JDN + (365 * (year - 1)) + Math.floor(year / 4) + (30 * (month - 1)) + day - 1;
}

export function daysInEthiopianMonth(year, month) {
  if (month >= 1 && month <= 12) return 30;
  if (month === 13) return year % 4 === 3 ? 6 : 5;
  return 0;
}

export function ethiopianToGregorian(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isInteger(y) || y < 1 || !Number.isInteger(m) || m < 1 || m > 13
    || !Number.isInteger(d) || d < 1 || d > daysInEthiopianMonth(y, m)) return '';
  const result = jdnToGregorian(ethiopianToJdn(y, m, d));
  return `${result.year}-${pad(result.month)}-${pad(result.day)}`;
}

export function gregorianToEthiopian(value) {
  const match = String(value || '').slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;

  const jdn = gregorianToJdn(year, month, day);
  const ethiopianYear = Math.floor(((4 * (jdn - ETHIOPIAN_EPOCH_JDN)) + 1463) / 1461);
  const dayOfYear = jdn - ethiopianToJdn(ethiopianYear, 1, 1);
  return {
    year: ethiopianYear,
    month: Math.floor(dayOfYear / 30) + 1,
    day: (dayOfYear % 30) + 1,
  };
}

export function formatEthiopianDate(value) {
  const date = gregorianToEthiopian(value);
  return date ? `${date.year}-${pad(date.month)}-${pad(date.day)} EC` : '—';
}
