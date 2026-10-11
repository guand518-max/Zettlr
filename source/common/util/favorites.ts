/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        Favorites helpers
 * CVM-Role:        Utility Functions
 * Maintainer:      idiary
 * License:         GNU GPL v3
 *
 * Description:     Shared helpers for workspace file/directory favorites.
 *
 * END HEADER
 */

export interface FavoriteItem {
  /** Absolute path to a file or directory. */
  path: string
  /** Display label in the favorites list. */
  title: string
}

/**
 * Returns a structured-clone-safe plain copy. Vue/Pinia reactive Proxies cannot
 * cross the Electron IPC boundary ("An object could not be cloned").
 */
export function toPlainFavorites (favorites: FavoriteItem[]): FavoriteItem[] {
  return favorites.map(item => ({
    path: String(item.path),
    title: String(item.title)
  }))
}

/**
 * Returns true if `absPath` is already in the favorites list.
 */
export function hasFavorite (favorites: FavoriteItem[], absPath: string): boolean {
  return favorites.some(item => item.path === absPath)
}

/**
 * Returns a copy of `favorites` with `item` appended, or unchanged if the path
 * is already present.
 */
export function addFavoriteItem (favorites: FavoriteItem[], item: FavoriteItem): FavoriteItem[] {
  const plain = toPlainFavorites(favorites)
  if (hasFavorite(plain, item.path)) {
    return plain
  }
  plain.push({ path: String(item.path), title: String(item.title) })
  return plain
}

/**
 * Returns a copy of `favorites` without the entry at `index`.
 */
export function removeFavoriteAt (favorites: FavoriteItem[], index: number): FavoriteItem[] {
  return toPlainFavorites(favorites).filter((_, i) => i !== index)
}

/**
 * Returns a copy of `favorites` with the title at `index` replaced.
 */
export function renameFavoriteAt (
  favorites: FavoriteItem[],
  index: number,
  title: string
): FavoriteItem[] {
  const trimmed = title.trim()
  return toPlainFavorites(favorites).map((item, i) => {
    if (i !== index) {
      return item
    }
    return { path: item.path, title: trimmed !== '' ? trimmed : item.path }
  })
}
