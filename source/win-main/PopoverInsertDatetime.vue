<template>
  <PopoverWrapper v-bind:target="props.target" v-on:close="$emit('close')">
    <div class="insert-datetime">
      <p class="insert-datetime-heading">
        {{ headingLabel }}
      </p>
      <button
        type="button"
        class="insert-datetime-option"
        v-on:click="insert('datetime')"
      >
        {{ datetimePreview }}
      </button>
      <button
        type="button"
        class="insert-datetime-option"
        v-on:click="insert('date')"
      >
        {{ datePreview }}
      </button>
    </div>
  </PopoverWrapper>
</template>

<script setup lang="ts">
/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        Insert Datetime Popover
 * CVM-Role:        View
 * Maintainer:      idiary
 * License:         GNU GPL v3
 *
 * Description:     Lets the user insert the current time in one of two Chinese
 *                  diary formats into the active editor.
 *
 * END HEADER
 */

import { trans } from '@common/i18n-renderer'
import PopoverWrapper from '@common/vue/PopoverWrapper.vue'
import { formatChineseDateTime, type ChineseDateTimeStyle } from '@common/util/diary'
import { DateTime } from 'luxon'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{ target: HTMLElement }>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'insert', value: string): void
}>()

const headingLabel = trans('Insert current time')
const now = ref(DateTime.local())
let tick: ReturnType<typeof setInterval>|undefined

const datetimePreview = computed(() => formatChineseDateTime(now.value, 'datetime'))
const datePreview = computed(() => formatChineseDateTime(now.value, 'date'))

function insert (style: ChineseDateTimeStyle): void {
  emit('insert', formatChineseDateTime(DateTime.local(), style))
  emit('close')
}

onMounted(() => {
  tick = setInterval(() => {
    now.value = DateTime.local()
  }, 1000)
})

onBeforeUnmount(() => {
  clearInterval(tick)
})
</script>

<style lang="less">
body {
  .insert-datetime {
    min-width: 220px;
    padding: 6px;

    .insert-datetime-heading {
      margin: 0 0 6px;
      font-size: 12px;
      opacity: 0.7;
    }

    .insert-datetime-option {
      display: block;
      width: 100%;
      margin: 0 0 4px;
      padding: 8px 10px;
      border: 1px solid transparent;
      border-radius: 4px;
      background: transparent;
      color: inherit;
      text-align: left;
      cursor: pointer;
      font: inherit;

      &:hover,
      &:focus {
        background-color: rgba(127, 127, 127, 0.2);
        border-color: rgba(127, 127, 127, 0.35);
      }

      &:last-child {
        margin-bottom: 0;
      }
    }
  }
}
</style>
