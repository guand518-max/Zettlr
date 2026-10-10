/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        Diary utilities
 * CVM-Role:        Utility Functions
 * Maintainer:      idiary
 * License:         GNU GPL v3
 *
 * Description:     Pure helpers for diary entries: date keys, file layout
 *                  (<root>/YYYY/MM/YYYY-MM-DD.md), templates, streaks, and
 *                  month grids. Shared between main and renderer.
 *
 * END HEADER
 */

import { DateTime } from 'luxon'

const DIARY_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const DIARY_FILE_RE = /^(\d{4}-\d{2}-\d{2})\.md$/i

/**
 * Formats a JavaScript date or luxon DateTime as a diary date key (YYYY-MM-DD,
 * local time).
 */
export function toDiaryDate (date: Date|DateTime): string {
  const dt = date instanceof Date ? DateTime.fromJSDate(date) : date
  return dt.toFormat('yyyy-MM-dd')
}

/**
 * Returns true if the given string is a valid calendar date in YYYY-MM-DD form.
 */
export function isValidDiaryDate (date: string): boolean {
  return DIARY_DATE_RE.test(date) && DateTime.fromISO(date).isValid
}

/**
 * Returns the path segments of a diary entry relative to the diary root, e.g.
 * `2026-10-10` -> `[ '2026', '10', '2026-10-10.md' ]`.
 */
export function diaryPathSegments (date: string): [string, string, string] {
  const match = DIARY_DATE_RE.exec(date)
  if (match === null || !isValidDiaryDate(date)) {
    throw new Error(`Invalid diary date: ${date}`)
  }
  return [ match[1], match[2], `${date}.md` ]
}

/**
 * Extracts the diary date from a filename such as `2026-10-10.md`. Returns
 * undefined if the filename is not a diary entry.
 */
export function parseDiaryFilename (filename: string): string|undefined {
  const match = DIARY_FILE_RE.exec(filename)
  if (match === null || !isValidDiaryDate(match[1])) {
    return undefined
  }
  return match[1]
}

/**
 * Renders a diary template. Supported variables: {{date}}, {{year}},
 * {{month}}, {{day}}, {{weekday}}, {{longDate}}.
 */
export function renderDiaryTemplate (template: string, date: string, locale: string): string {
  const dt = DateTime.fromISO(date).setLocale(locale)
  const variables: Record<string, string> = {
    date,
    year: dt.toFormat('yyyy'),
    month: dt.toFormat('MM'),
    day: dt.toFormat('dd'),
    weekday: dt.toFormat('cccc'),
    longDate: dt.toLocaleString(DateTime.DATE_FULL)
  }

  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (full, name: string) => variables[name] ?? full)
}

/**
 * Counts consecutive days with an entry, ending today. If today has no entry
 * yet, the streak ending yesterday still counts.
 */
export function computeStreak (dates: Iterable<string>, today: string): number {
  const set = new Set(dates)
  let cursor = DateTime.fromISO(today)
  if (!set.has(today)) {
    cursor = cursor.minus({ days: 1 })
  }

  let streak = 0
  while (set.has(toDiaryDate(cursor))) {
    streak++
    cursor = cursor.minus({ days: 1 })
  }
  return streak
}

export interface DiaryMonthGrid {
  /** Number of empty cells before day 1 (weeks start on Monday). */
  padding: number
  daysInMonth: number
}

/**
 * Computes the layout of a month for a Monday-first calendar grid.
 */
export function buildMonthGrid (year: number, month: number): DiaryMonthGrid {
  const start = DateTime.local(year, month, 1)
  return {
    padding: start.weekday - 1,
    daysInMonth: start.daysInMonth ?? 0
  }
}
