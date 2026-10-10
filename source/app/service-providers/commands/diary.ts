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
import { getDefaultDiaryRoot } from '@providers/config/get-config-template'

export interface DiaryOpenPayload {
  date: string
  windowId?: string
  leafId?: string
}

export interface DiaryOpenResult {
  path: string
  created: boolean
}

export interface DiaryEntryList {
  root: string
  dates: string[]
}

export default class Diary extends ZettlrCommand {
  constructor (app: AppServiceContainer) {
    super(app, [ 'diary-open', 'diary-list-entries' ])
  }

  async run (evt: string, arg?: DiaryOpenPayload): Promise<DiaryOpenResult|DiaryEntryList|undefined> {
    if (evt === 'diary-open') {
      return await this.openEntry(arg)
    } else if (evt === 'diary-list-entries') {
      return await this.listEntries()
    }
  }

  private getRoot (): string {
    const configured = this._app.config.get().diary.rootDirectory.trim()
    return path.resolve(configured === '' ? getDefaultDiaryRoot() : configured)
  }

  private async getTemplate (): Promise<string> {
    const { template, templateFile } = this._app.config.get().diary
    if (templateFile.trim() !== '' && await this._app.fsal.isFile(templateFile)) {
      try {
        return await this._app.fsal.readTextFile(templateFile)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        this._app.log.error(`[Diary] Could not read template file ${templateFile}: ${message}`, err)
      }
    }
    return template
  }

  /**
   * Returns the diary root and all dates (YYYY-MM-DD) with an entry, sorted.
   */
  private async listEntries (): Promise<DiaryEntryList> {
    const root = this.getRoot()
    if (!await this._app.fsal.isDir(root)) {
      return { root, dates: [] }
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

    return { root, dates: dates.sort() }
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
      const template = await this.getTemplate()
      const contents = renderDiaryTemplate(template, payload.date, this._app.config.get().appLang)
      await this._app.fsal.writeTextFile(filePath, contents)
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
