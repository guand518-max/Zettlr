/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        Favorites utilities test
 * CVM-Role:        Unit Test
 * Maintainer:      idiary
 * License:         GNU GPL v3
 *
 * Description:     Tests the favorites helper functions.
 *
 * END HEADER
 */

import assert from 'assert'
import {
  addFavoriteItem,
  hasFavorite,
  removeFavoriteAt,
  renameFavoriteAt,
  toPlainFavorites,
  type FavoriteItem
} from '../source/common/util/favorites'

describe('Utility#favorites', function () {
  const base: FavoriteItem[] = [
    { path: '/a/file.md', title: 'File' },
    { path: '/a/dir', title: 'Dir' }
  ]

  it('detects existing favorites', function () {
    assert.strictEqual(hasFavorite(base, '/a/file.md'), true)
    assert.strictEqual(hasFavorite(base, '/missing'), false)
  })

  it('appends favorites without duplicates', function () {
    assert.strictEqual(addFavoriteItem(base, { path: '/a/file.md', title: 'X' }).length, 2)
    assert.deepStrictEqual(
      addFavoriteItem(base, { path: '/b/new.md', title: 'New' }),
      [ ...base, { path: '/b/new.md', title: 'New' } ]
    )
  })

  it('removes favorites by index', function () {
    assert.deepStrictEqual(removeFavoriteAt(base, 0), [ { path: '/a/dir', title: 'Dir' } ])
  })

  it('renames favorites and falls back when empty', function () {
    assert.deepStrictEqual(
      renameFavoriteAt(base, 1, '  Renamed  '),
      [ { path: '/a/file.md', title: 'File' }, { path: '/a/dir', title: 'Renamed' } ]
    )
    assert.deepStrictEqual(
      renameFavoriteAt(base, 0, '   '),
      [ { path: '/a/file.md', title: '/a/file.md' }, { path: '/a/dir', title: 'Dir' } ]
    )
  })

  it('produces structured-clone-safe plain objects', function () {
    const plain = toPlainFavorites(base)
    assert.deepStrictEqual(plain, base)
    // Proxies (e.g. from Vue) are not structured-cloneable; plain objects are.
    assert.doesNotThrow(() => structuredClone(plain))
  })
})
