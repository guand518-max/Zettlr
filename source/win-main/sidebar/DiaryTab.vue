<template>
  <div role="tabpanel" class="diary-tab">
    <h1>{{ diaryLabel }}</h1>

    <div class="diary-toolbar">
      <ButtonControl
        v-bind:icon="'angle'"
        v-bind:direction="'left'"
        v-bind:inline="true"
        v-bind:title="previousMonthLabel"
        v-on:click="shiftMonth(-1)"
      ></ButtonControl>
      <span class="diary-month-label">{{ monthLabel }}</span>
      <ButtonControl
        v-bind:icon="'angle'"
        v-bind:direction="'right'"
        v-bind:inline="true"
        v-bind:title="nextMonthLabel"
        v-on:click="shiftMonth(1)"
      ></ButtonControl>
    </div>

    <div class="diary-grid">
      <div v-for="name in weekdayNames" v-bind:key="name" class="diary-weekday">
        {{ name }}
      </div>
      <div v-for="num in grid.padding" v-bind:key="'pad-' + num" class="diary-day-padding"></div>
      <button
        v-for="day in grid.daysInMonth"
        v-bind:key="day"
        type="button"
        v-bind:class="{
          'diary-day': true,
          'has-entry': entries.has(dateFor(day)),
          'is-today': dateFor(day) === today,
          'is-active': dateFor(day) === activeDate
        }"
        v-bind:title="dateFor(day)"
        v-on:click="openEntry(dateFor(day))"
      >
        {{ day }}
      </button>
    </div>

    <div class="diary-actions">
      <ButtonControl
        v-bind:label="openTodayLabel"
        v-bind:primary="true"
        v-on:click="openToday()"
      ></ButtonControl>
    </div>

    <section class="diary-favorites">
      <h2>{{ favoritesLabel }}</h2>
      <div class="diary-favorites-actions">
        <ButtonControl
          v-bind:label="addFavoriteLabel"
          v-bind:disabled="!canAddFavorite"
          v-bind:inline="true"
          v-on:click="addCurrentFavorite()"
        ></ButtonControl>
      </div>
      <ul v-if="favorites.length > 0" class="diary-favorites-list">
        <li
          v-for="(item, index) in favorites"
          v-bind:key="item.path"
          v-bind:class="{ 'is-active': item.path === activeFavoritePath }"
        >
          <input
            v-if="editingIndex === index"
            type="text"
            class="diary-favorite-title-input"
            v-bind:value="editingTitle"
            v-on:input="editingTitle = ($event.target as HTMLInputElement).value"
            v-on:keydown.enter.prevent="commitRename()"
            v-on:keydown.escape.prevent="cancelRename()"
            v-on:blur="commitRename()"
          >
          <button
            v-else
            type="button"
            class="diary-favorite-open"
            v-bind:title="item.path"
            v-on:click="openFavorite(item)"
            v-on:dblclick="startRename(index)"
          >
            <span
              class="diary-favorite-kind"
              v-bind:class="favoriteKind(item.path)"
            ></span>
            {{ item.title }}
          </button>
          <button
            type="button"
            class="diary-favorite-remove"
            v-bind:title="removeFavoriteLabel"
            v-on:click="removeFavorite(index)"
          >
            ×
          </button>
        </li>
      </ul>
      <p v-else class="diary-favorites-empty">
        {{ favoritesEmptyLabel }}
      </p>
    </section>

    <p class="diary-stats">
      {{ monthCountLabel }}<br>
      {{ streakLabel }}
    </p>
    <p class="diary-root" v-bind:title="rootDirectory">
      {{ rootDirectory }}
    </p>
  </div>
</template>

<script setup lang="ts">
/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        DiaryTab
 * CVM-Role:        View
 * Maintainer:      idiary
 * License:         GNU GPL v3
 *
 * Description:     Sidebar tab with a month calendar to open or create diary
 *                  entries, plus favorites for any workspace file or directory.
 *
 * END HEADER
 */

import { trans } from '@common/i18n-renderer'
import ButtonControl from '@common/vue/form/elements/ButtonControl.vue'
import { pathBasename } from '@common/util/renderer-path-polyfill'
import {
  buildMonthGrid,
  computeStreak,
  formatChineseDateTime,
  parseDiaryFilename,
  toDiaryDate
} from '@common/util/diary'
import {
  addFavoriteItem,
  removeFavoriteAt,
  renameFavoriteAt,
  hasFavorite,
  toPlainFavorites,
  type FavoriteItem
} from '@common/util/favorites'
import { DateTime, Info } from 'luxon'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useConfigStore, useDocumentTreeStore, useWorkspaceStore, useWindowStateStore } from 'source/pinia'
import type { FSALEventPayload } from 'source/app/service-providers/fsal'
import type { DiaryEntryList } from 'source/app/service-providers/commands/diary'
import type { DocumentManagerIPCAPI } from 'source/app/service-providers/documents'
import getDocumentTitle from '../util/get-document-title'

const ipcRenderer = window.ipc
const searchParams = new URLSearchParams(window.location.search)
const windowId = searchParams.get('window_id') ?? undefined

const configStore = useConfigStore()
const documentTreeStore = useDocumentTreeStore()
const workspaceStore = useWorkspaceStore()
const windowStateStore = useWindowStateStore()

const diaryLabel = trans('Diary')
const previousMonthLabel = trans('Previous month')
const nextMonthLabel = trans('Next month')
const openTodayLabel = trans('Open today\'s diary')
const favoritesLabel = trans('Favorites')
const addFavoriteLabel = trans('Add to favorites')
const removeFavoriteLabel = trans('Remove from favorites')
const favoritesEmptyLabel = trans('No favorites yet. Right-click a file or folder, or open one and add it here.')

const locale = computed(() => configStore.config.appLang)
const configuredRoot = computed(() => configStore.config.diary.rootDirectory)
const favorites = computed<FavoriteItem[]>(() => configStore.config.favorites ?? [])
const openDirectory = computed(() => configStore.config.openDirectory)
// Resolved by main, which applies the default if nothing is configured
const rootDirectory = ref('')

const today = ref(toDiaryDate(DateTime.local()))
const viewMonth = ref(DateTime.local().startOf('month'))
const entries = ref<Set<string>>(new Set())
const editingIndex = ref<number|null>(null)
const editingTitle = ref('')

const grid = computed(() => buildMonthGrid(viewMonth.value.year, viewMonth.value.month))

const monthLabel = computed(() => {
  return viewMonth.value.setLocale(locale.value).toLocaleString({ year: 'numeric', month: 'long' })
})

const weekdayNames = computed(() => Info.weekdays('short', { locale: locale.value }))

const activeFilePath = computed(() => documentTreeStore.lastLeafActiveFile?.path)

const activeDate = computed(() => {
  const filePath = activeFilePath.value
  if (filePath === undefined || rootDirectory.value === '' || !filePath.startsWith(rootDirectory.value)) {
    return undefined
  }
  return parseDiaryFilename(pathBasename(filePath))
})

const candidateFavorite = computed<FavoriteItem|undefined>(() => {
  if (activeFilePath.value !== undefined) {
    return {
      path: activeFilePath.value,
      title: favoriteTitleForPath(activeFilePath.value)
    }
  }
  if (typeof openDirectory.value === 'string' && openDirectory.value !== '') {
    return {
      path: openDirectory.value,
      title: favoriteTitleForPath(openDirectory.value)
    }
  }
  return undefined
})

const canAddFavorite = computed(() => {
  return candidateFavorite.value !== undefined &&
    !hasFavorite(favorites.value, candidateFavorite.value.path)
})

const activeFavoritePath = computed(() => {
  return activeFilePath.value ?? openDirectory.value
})

const monthCount = computed(() => {
  const prefix = viewMonth.value.toFormat('yyyy-MM-')
  return [...entries.value].filter(date => date.startsWith(prefix)).length
})

const monthCountLabel = computed(() => trans('Entries this month: %s', monthCount.value))
const streakLabel = computed(() => trans('Current streak: %s days', computeStreak(entries.value, today.value)))

function dateFor (day: number): string {
  return toDiaryDate(viewMonth.value.set({ day }))
}

function shiftMonth (delta: number): void {
  viewMonth.value = viewMonth.value.plus({ months: delta })
}

async function loadEntries (): Promise<void> {
  const list: DiaryEntryList = await ipcRenderer.invoke('application', { command: 'diary-list-entries' })
  rootDirectory.value = list.root
  entries.value = new Set(list.dates)
}

function openEntry (date: string): void {
  ipcRenderer.invoke('application', {
    command: 'diary-open',
    payload: { date, windowId, leafId: documentTreeStore.lastLeafId }
  })
    .then(() => loadEntries())
    .catch(err => console.error(err))
}

function openToday (): void {
  today.value = toDiaryDate(DateTime.local())
  viewMonth.value = DateTime.local().startOf('month')
  openEntry(today.value)
}

function favoriteKind (absPath: string): 'file'|'directory' {
  const descriptor = workspaceStore.descriptorMap.get(absPath)
  if (descriptor?.type === 'directory') {
    return 'directory'
  }
  return 'file'
}

function favoriteTitleForPath (absPath: string): string {
  const descriptor = workspaceStore.descriptorMap.get(absPath)
  if (descriptor?.type === 'file') {
    return getDocumentTitle(descriptor)
  }
  if (descriptor?.type === 'directory') {
    return descriptor.name
  }
  const base = pathBasename(absPath)
  const diaryDate = parseDiaryFilename(base)
  if (diaryDate !== undefined) {
    return formatChineseDateTime(DateTime.fromISO(diaryDate), 'date')
  }
  return base.replace(/\.[^.]+$/, '') || base
}

function saveFavorites (next: FavoriteItem[]): void {
  // Must be plain data: config.set crosses the Electron IPC boundary.
  configStore.setConfigValue('favorites', toPlainFavorites(next))
}

function addCurrentFavorite (): void {
  if (candidateFavorite.value === undefined || !canAddFavorite.value) {
    return
  }
  saveFavorites(addFavoriteItem(favorites.value, candidateFavorite.value))
}

function removeFavorite (index: number): void {
  if (editingIndex.value === index) {
    cancelRename()
  }
  saveFavorites(removeFavoriteAt(favorites.value, index))
}

function openFavorite (item: FavoriteItem): void {
  if (favoriteKind(item.path) === 'directory') {
    configStore.setConfigValue('window.fileManagerVisible', true)
    configStore.setConfigValue('openDirectory', item.path)
    if (!windowStateStore.uncollapsedDirectories.includes(item.path)) {
      windowStateStore.uncollapsedDirectories.push(item.path)
    }
    return
  }

  ipcRenderer.invoke('documents-provider', {
    command: 'open-file',
    payload: {
      path: item.path,
      windowId,
      leafId: documentTreeStore.lastLeafId
    }
  } as DocumentManagerIPCAPI)
    .catch(err => console.error(err))
}

function startRename (index: number): void {
  editingIndex.value = index
  editingTitle.value = favorites.value[index]?.title ?? ''
  nextTick().then(() => {
    const input = document.querySelector('.diary-favorite-title-input') as HTMLInputElement|null
    input?.focus()
    input?.select()
  }).catch(err => console.error(err))
}

function commitRename (): void {
  const index = editingIndex.value
  if (index === null) {
    return
  }
  const next = renameFavoriteAt(favorites.value, index, editingTitle.value)
  editingIndex.value = null
  saveFavorites(next)
}

function cancelRename (): void {
  editingIndex.value = null
  editingTitle.value = ''
}

let reloadTimeout: ReturnType<typeof setTimeout>|undefined
function scheduleReload (): void {
  clearTimeout(reloadTimeout)
  reloadTimeout = setTimeout(() => {
    loadEntries().catch(err => console.error(err))
  }, 300)
}

let stopListening: (() => void)|undefined
let todayInterval: ReturnType<typeof setInterval>|undefined

onMounted(() => {
  loadEntries().catch(err => console.error(err))

  stopListening = ipcRenderer.on('fsal-event', (_, payload: FSALEventPayload) => {
    const changedPath = 'path' in payload ? payload.path : payload.descriptor.path
    if (rootDirectory.value !== '' && changedPath.startsWith(rootDirectory.value)) {
      scheduleReload()
    }
  })

  todayInterval = setInterval(() => {
    today.value = toDiaryDate(DateTime.local())
  }, 60_000)
})

onBeforeUnmount(() => {
  stopListening?.()
  clearTimeout(reloadTimeout)
  clearInterval(todayInterval)
})

watch(configuredRoot, scheduleReload)
</script>

<style lang="less">
body {
  #sidebar .diary-tab {
    .diary-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }

    .diary-month-label {
      font-weight: bold;
    }

    .diary-grid {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 3px;
      text-align: center;
    }

    .diary-weekday {
      font-size: 11px;
      opacity: 0.6;
      padding-bottom: 4px;
    }

    .diary-day {
      min-width: 0;
      font-size: 12px;
      padding: 5px 0;
      border: 1px solid transparent;
      border-radius: 4px;
      background-color: transparent;
      color: inherit;
      cursor: pointer;

      &:hover { background-color: rgba(127, 127, 127, 0.2); }

      &.has-entry {
        background-color: var(--system-accent-color, #1cb27e);
        color: white;
      }

      &.is-today { border-color: var(--system-accent-color, #1cb27e); font-weight: bold; }

      &.is-active { outline: 2px solid rgba(127, 127, 127, 0.8); }
    }

    .diary-actions {
      margin: 12px 0;
      text-align: center;
    }

    .diary-favorites {
      margin: 12px 0;
      padding-top: 8px;
      border-top: 1px solid rgba(127, 127, 127, 0.25);

      h2 {
        margin: 0 0 6px;
        font-size: 13px;
      }
    }

    .diary-favorites-actions {
      margin-bottom: 6px;
    }

    .diary-favorites-list {
      list-style: none;
      margin: 0;
      padding: 0;

      li {
        display: flex;
        align-items: center;
        gap: 4px;
        margin: 0 0 2px;
        border-radius: 4px;

        &.is-active {
          background-color: rgba(127, 127, 127, 0.15);
        }
      }
    }

    .diary-favorite-open,
    .diary-favorite-title-input {
      flex: 1;
      min-width: 0;
      padding: 4px 6px;
      border: 1px solid transparent;
      border-radius: 4px;
      background: transparent;
      color: inherit;
      font: inherit;
      font-size: 12px;
      text-align: left;
    }

    .diary-favorite-open {
      display: flex;
      align-items: center;
      gap: 6px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      cursor: pointer;

      &:hover {
        background-color: rgba(127, 127, 127, 0.2);
      }
    }

    .diary-favorite-kind {
      flex: 0 0 auto;
      width: 8px;
      height: 8px;
      border-radius: 2px;
      background-color: rgba(127, 127, 127, 0.7);

      &.directory {
        background-color: var(--system-accent-color, #1cb27e);
      }
    }

    .diary-favorite-title-input {
      border-color: rgba(127, 127, 127, 0.4);
    }

    .diary-favorite-remove {
      flex: 0 0 auto;
      width: 22px;
      height: 22px;
      padding: 0;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: inherit;
      opacity: 0.55;
      cursor: pointer;
      font-size: 16px;
      line-height: 1;

      &:hover {
        opacity: 1;
        background-color: rgba(127, 127, 127, 0.2);
      }
    }

    .diary-favorites-empty {
      margin: 0;
      font-size: 11px;
      opacity: 0.6;
    }

    .diary-stats {
      font-size: 12px;
      line-height: 1.6;
    }

    .diary-root {
      font-size: 11px;
      opacity: 0.6;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}
</style>
