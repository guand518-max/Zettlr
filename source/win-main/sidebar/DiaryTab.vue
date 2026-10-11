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
 *                  entries.
 *
 * END HEADER
 */

import { trans } from '@common/i18n-renderer'
import ButtonControl from '@common/vue/form/elements/ButtonControl.vue'
import { pathBasename } from '@common/util/renderer-path-polyfill'
import { buildMonthGrid, computeStreak, parseDiaryFilename, toDiaryDate } from '@common/util/diary'
import { DateTime, Info } from 'luxon'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useConfigStore, useDocumentTreeStore } from 'source/pinia'
import type { FSALEventPayload } from 'source/app/service-providers/fsal'
import type { DiaryEntryList } from 'source/app/service-providers/commands/diary'

const ipcRenderer = window.ipc
const searchParams = new URLSearchParams(window.location.search)
const windowId = searchParams.get('window_id') ?? undefined

const configStore = useConfigStore()
const documentTreeStore = useDocumentTreeStore()

const diaryLabel = trans('Diary')
const previousMonthLabel = trans('Previous month')
const nextMonthLabel = trans('Next month')
const openTodayLabel = trans('Open today\'s diary')

const locale = computed(() => configStore.config.appLang)
const configuredRoot = computed(() => configStore.config.diary.rootDirectory)
// Resolved by main, which applies the default if nothing is configured
const rootDirectory = ref('')

const today = ref(toDiaryDate(DateTime.local()))
const viewMonth = ref(DateTime.local().startOf('month'))
const entries = ref<Set<string>>(new Set())

const grid = computed(() => buildMonthGrid(viewMonth.value.year, viewMonth.value.month))

const monthLabel = computed(() => {
  return viewMonth.value.setLocale(locale.value).toLocaleString({ year: 'numeric', month: 'long' })
})

const weekdayNames = computed(() => Info.weekdays('short', { locale: locale.value }))

const activeDate = computed(() => {
  const file = documentTreeStore.lastLeafActiveFile
  if (file === undefined || rootDirectory.value === '' || !file.path.startsWith(rootDirectory.value)) {
    return undefined
  }
  return parseDiaryFilename(pathBasename(file.path))
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
      // The Windows theme gives every button a 50px min-width, which would
      // push the Sunday column out of a narrow sidebar.
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
