import { APP_LOCALE, APP_TIMEZONE } from '../constants.js';

export type DateInput = Date | string | number;

/** Jam sistem aplikasi. Asia/Jakarta, tanpa offset eksplisit pada tampilan. */
const longDateFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: APP_TIMEZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const shortDateFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: APP_TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: APP_TIMEZONE,
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const timeFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: APP_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
});

const monthYearFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: APP_TIMEZONE,
  month: 'long',
  year: 'numeric',
});

const toDate = (input: DateInput): Date => {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError('Nilai tanggal tidak valid.');
  }
  return date;
};

/** "Minggu, 3 November 2026" */
export function formatDateLong(input: DateInput): string {
  return longDateFormatter.format(toDate(input));
}

/** "03/11/2026" */
export function formatDateShort(input: DateInput): string {
  return shortDateFormatter.format(toDate(input));
}

/** "3 November 2026, 09.00" */
export function formatDateTime(input: DateInput): string {
  return dateTimeFormatter.format(toDate(input));
}

/** "09.00" */
export function formatTime(input: DateInput): string {
  return timeFormatter.format(toDate(input));
}

/** "November 2026" */
export function formatMonthYear(input: DateInput): string {
  return monthYearFormatter.format(toDate(input));
}

/** Nilai untuk `<input type="date">`, mis. "2026-11-03" (tanggal lokal Jakarta). */
export function toDateInputValue(input: DateInput): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(toDate(input));

  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';

  return `${get('year')}-${get('month')}-${get('day')}`;
}
