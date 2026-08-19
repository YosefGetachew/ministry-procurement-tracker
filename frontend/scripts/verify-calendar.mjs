import {
  daysInEthiopianMonth,
  ethiopianToGregorian,
  gregorianToEthiopian,
} from '../src/utils/ethiopianCalendar.js';

const knownDates = [
  [2016, 1, 1, '2023-09-12'],
  [2017, 1, 1, '2024-09-11'],
  [2015, 13, 6, '2023-09-11'],
];

for (const [year, month, day, gregorian] of knownDates) {
  const converted = ethiopianToGregorian(year, month, day);
  const reversed = gregorianToEthiopian(gregorian);
  if (converted !== gregorian || reversed?.year !== year || reversed?.month !== month || reversed?.day !== day) {
    throw new Error(`Calendar conversion failed for ${year}-${month}-${day} EC: ${converted}; reverse ${JSON.stringify(reversed)}`);
  }
}

if (daysInEthiopianMonth(2015, 13) !== 6 || daysInEthiopianMonth(2016, 13) !== 5) {
  throw new Error('Ethiopian leap-year validation failed');
}

for (let year = 1900; year <= 2100; year += 5) {
  for (let month = 1; month <= 12; month += 1) {
    const gregorian = `${year}-${String(month).padStart(2, '0')}-15`;
    const ethiopian = gregorianToEthiopian(gregorian);
    if (!ethiopian || ethiopianToGregorian(ethiopian.year, ethiopian.month, ethiopian.day) !== gregorian) {
      throw new Error(`Round-trip conversion failed for ${gregorian} GC`);
    }
  }
}

console.log('Calendar conversion tests passed');
