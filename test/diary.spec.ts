/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        Diary utilities test
 * CVM-Role:        Unit Test
 * Maintainer:      idiary
 * License:         GNU GPL v3
 *
 * Description:     Tests the diary helper functions.
 *
 * END HEADER
 */

import assert from 'assert'
import { DateTime } from 'luxon'
import {
  toDiaryDate,
  isValidDiaryDate,
  diaryPathSegments,
  parseDiaryFilename,
  renderDiaryTemplate,
  computeStreak,
  buildMonthGrid,
  formatChineseDateTime
} from '../source/common/util/diary'

describe('Utility#diary', function () {
  it('formats dates as YYYY-MM-DD', function () {
    assert.strictEqual(toDiaryDate(new Date(2026, 0, 5)), '2026-01-05')
    assert.strictEqual(toDiaryDate(DateTime.local(2026, 12, 31)), '2026-12-31')
  })

  it('validates diary dates', function () {
    assert.strictEqual(isValidDiaryDate('2026-10-10'), true)
    assert.strictEqual(isValidDiaryDate('2024-02-29'), true)
    assert.strictEqual(isValidDiaryDate('2026-02-29'), false)
    assert.strictEqual(isValidDiaryDate('2026-13-01'), false)
    assert.strictEqual(isValidDiaryDate('2026-1-1'), false)
    assert.strictEqual(isValidDiaryDate('../2026-10-10'), false)
  })

  it('computes path segments', function () {
    assert.deepStrictEqual(diaryPathSegments('2026-10-10'), [ '2026', '10', '2026-10-10.md' ])
    assert.throws(() => diaryPathSegments('2026-02-30'))
    assert.throws(() => diaryPathSegments('../../etc/passwd'))
  })

  it('parses diary filenames', function () {
    assert.strictEqual(parseDiaryFilename('2026-10-10.md'), '2026-10-10')
    assert.strictEqual(parseDiaryFilename('2026-10-10.MD'), '2026-10-10')
    assert.strictEqual(parseDiaryFilename('2026-10-10.txt'), undefined)
    assert.strictEqual(parseDiaryFilename('notes.md'), undefined)
    assert.strictEqual(parseDiaryFilename('2026-02-30.md'), undefined)
  })

  it('renders templates', function () {
    const template = '# {{date}} {{ weekday }}\n{{year}}/{{month}}/{{day}} {{unknown}}'
    assert.strictEqual(
      renderDiaryTemplate(template, '2026-10-10', 'en-US'),
      '# 2026-10-10 Saturday\n2026/10/10 {{unknown}}'
    )
    assert.strictEqual(renderDiaryTemplate('{{weekday}}', '2026-10-10', 'zh-CN'), '星期六')
  })

  it('computes writing streaks', function () {
    const dates = [ '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10' ]
    assert.strictEqual(computeStreak(dates, '2026-10-10'), 4)
    // Today not yet written: streak up to yesterday still counts
    assert.strictEqual(computeStreak(dates, '2026-10-11'), 4)
    assert.strictEqual(computeStreak(dates, '2026-10-12'), 0)
    assert.strictEqual(computeStreak([], '2026-10-10'), 0)
    // Across month boundaries
    assert.strictEqual(computeStreak([ '2026-09-30', '2026-10-01' ], '2026-10-01'), 2)
  })

  it('builds Monday-first month grids', function () {
    // 2026-10-01 is a Thursday
    assert.deepStrictEqual(buildMonthGrid(2026, 10), { padding: 3, daysInMonth: 31 })
    // 2024-02-01 is a Thursday, leap year
    assert.deepStrictEqual(buildMonthGrid(2024, 2), { padding: 3, daysInMonth: 29 })
    // 2026-06-01 is a Monday
    assert.deepStrictEqual(buildMonthGrid(2026, 6), { padding: 0, daysInMonth: 30 })
  })

  it('formats Chinese date and datetime strings', function () {
    const dt = DateTime.local(2026, 6, 1, 0, 56, 33)
    assert.strictEqual(formatChineseDateTime(dt, 'date'), '2026年6月1日')
    assert.strictEqual(formatChineseDateTime(dt, 'datetime'), '2026年6月1日 00:56:33')
    assert.strictEqual(formatChineseDateTime(DateTime.local(2026, 10, 11, 19, 15, 36), 'date'), '2026年10月11日')
  })
})
