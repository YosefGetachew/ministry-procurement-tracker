import React, { useEffect, useMemo, useState } from 'react';
import { daysInEthiopianMonth, ethiopianToGregorian, formatEthiopianDate, gregorianToEthiopian } from '../utils/ethiopianCalendar';

const ETHIOPIAN_MONTHS = [
  'Meskerem', 'Tikimt', 'Hidar', 'Tahsas', 'Tir', 'Yekatit',
  'Megabit', 'Miazia', 'Ginbot', 'Sene', 'Hamle', 'Nehase', 'Pagume',
];

const EMPTY_DATE = { year: '', month: '', day: '' };

export default function DualCalendarDateInput({ value, onChange, label = 'Date', id, disabled = false, required = false }) {
  const normalizedValue = value ? String(value).slice(0, 10) : '';
  const [ethiopian, setEthiopian] = useState(() => gregorianToEthiopian(normalizedValue) || EMPTY_DATE);

  useEffect(() => {
    setEthiopian(gregorianToEthiopian(normalizedValue) || EMPTY_DATE);
  }, [normalizedValue]);

  const maximumDay = useMemo(() => {
    if (!ethiopian.year || !ethiopian.month) return 30;
    return daysInEthiopianMonth(Number(ethiopian.year), Number(ethiopian.month));
  }, [ethiopian.year, ethiopian.month]);

  function updateEthiopian(part, rawValue) {
    const next = { ...ethiopian, [part]: rawValue === '' ? '' : Number(rawValue) };
    if (next.day && next.year && next.month) {
      const allowedDays = daysInEthiopianMonth(Number(next.year), Number(next.month));
      if (Number(next.day) > allowedDays) next.day = allowedDays;
    }
    setEthiopian(next);
    if (!next.year && !next.month && !next.day) {
      onChange('');
      return;
    }
    if (next.year && next.month && next.day) {
      const converted = ethiopianToGregorian(next.year, next.month, next.day);
      if (converted) onChange(converted);
    }
  }

  return (
    <div className="pt-dual-calendar">
      <div className="pt-calendar-side">
        <span className="pt-calendar-label">Gregorian (GC)</span>
        <input
          id={id}
          type="date"
          value={normalizedValue}
          onChange={(event) => onChange(event.target.value)}
          aria-label={`${label} Gregorian calendar`}
          disabled={disabled}
          required={required}
        />
      </div>
      <div className="pt-calendar-divider" aria-hidden="true">⇄</div>
      <div className="pt-calendar-side">
        <span className="pt-calendar-label">Ethiopian (EC)</span>
        <div className="pt-ethiopian-date-inputs">
          <input
            type="number"
            min="1"
            max="9999"
            value={ethiopian.year}
            onChange={(event) => updateEthiopian('year', event.target.value)}
            placeholder="Year"
            aria-label={`${label} Ethiopian year`}
            disabled={disabled}
          />
          <select value={ethiopian.month} onChange={(event) => updateEthiopian('month', event.target.value)} aria-label={`${label} Ethiopian month`} disabled={disabled}>
            <option value="">Month</option>
            {ETHIOPIAN_MONTHS.map((month, index) => <option key={month} value={index + 1}>{index + 1} · {month}</option>)}
          </select>
          <select value={ethiopian.day} onChange={(event) => updateEthiopian('day', event.target.value)} aria-label={`${label} Ethiopian day`} disabled={disabled}>
            <option value="">Day</option>
            {Array.from({ length: maximumDay }, (_, index) => index + 1).map((day) => <option key={day} value={day}>{day}</option>)}
          </select>
        </div>
      </div>
      <small className="pt-calendar-conversion">{normalizedValue ? `${normalizedValue} GC · ${formatEthiopianDate(normalizedValue)}` : 'Enter either calendar; the other updates automatically.'}</small>
    </div>
  );
}
