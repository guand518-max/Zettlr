/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        Diary command
 * CVM-Role:        <none>
 * Maintainer:      idiary
 * License:         GNU GPL v3
 *
 * Description:     Opens (and creates if necessary) diary entries stored as
 *                  <root>/YYYY/MM/YYYY-MM-DD.md, and lists existing entries.
 *
 * END HEADER
 */

import ZettlrCommand from './zettlr-command'
import path from 'path'
import { promises as fs } from 'fs'
import type { AppServiceContainer } from 'source/app/app-service-container'
import { diaryPathSegments, isValidDiaryDate, parseDiaryFilename, renderDiaryTemplate } from '@common/util/diary'

export interface DiaryOpenPayload {
  date: string
  windowId?: string
  leafId?: string
}

export interface DiaryOpenResult {
  path: string
  created: boolean
}

export default class Diary extends ZettlrCommand {
  constructor (app: AppServiceContainer) {
    super(app, [ 'diary-open', 'diary-list-entries' ])
  }

  async run (evt: string, arg?: DiaryOpenPayload): Promise<DiaryOpenResult|string[]|undefined> {
    if (evt === 'diary-open') {
      return await this.openEntry(arg)
    } else if (evt === 'diary-list-entries') {
      return await this.listEntries()
    }
  }

  private getRoot (): string {
    return path.resolve(this._app.config.get().diary.rootDirectory)
  }

  /**
   * Returns all diary dates (YYYY-MM-DD) that have an entry, sorted ascending.
   */
  private async listEntries (): Promise<string[]> {
    const root = this.getRoot()
    if (!await this._app.fsal.isDir(root)) {
      return []
    }

    const dates: string[] = []
    for (const year of await fs.readdir(root)) {
      if (!/^\d{4}$/.test(year) || !await this._app.fsal.isDir(path.join(root, year))) {
        continue
      }

      for (const month of await fs.readdir(path.join(root, year))) {
        const monthDir = path.join(root, year, month)
        if (!/^\d{2}$/.test(month) || !await this._app.fsal.isDir(monthDir)) {
          continue
        }

        for (const filename of await fs.readdir(monthDir)) {
          const date = parseDiaryFilename(filename)
          if (date !== undefined && date.startsWith(`${year}-${month}-`)) {
            dates.push(date)
          }
        }
      }
    }

    return dates.sort()
  }

  private async openEntry (payload?: DiaryOpenPayload): Promise<DiaryOpenResult|undefined> {
    if (typeof payload?.date !== 'string' || !isValidDiaryDate(payload.date)) {
      this._app.log.error(`[Diary] Cannot open entry: Invalid date ${String(payload?.date)}`)
      return undefined
    }

    const root = this.getRoot()
    const [ year, month, filename ] = diaryPathSegments(payload.date)
    const filePath = path.join(root, year, month, filename)

    await fs.mkdir(path.dirname(filePath), { recursive: true })

    let created = false
    if (!await this._app.fsal.pathExists(filePath)) {
      const { diary, appLang } = this._app.config.get()
      await this._app.fsal.writeTextFile(filePath, renderDiaryTemplate(diary.template, payload.date, appLang))
      created = true
    }

    // Load the diary root as a workspace so it shows up in the file manager
    // and its changes are watched.
    const { openWorkspaces } = this._app.config.get().app
    const isLoaded = openWorkspaces.some(ws => root === ws || root.startsWith(ws + path.sep))
    if (!isLoaded) {
      this._app.config.addPath(root)
    }

    const windowId = payload.windowId ?? this._app.documents.windowKeys()[0]
    await this._app.documents.openFile(windowId, payload.leafId, filePath)

    return { path: filePath, created }
  }
}
