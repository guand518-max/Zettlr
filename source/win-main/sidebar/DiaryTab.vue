<template>
  <div role="tabpanel">
    <h1>{{ diaryLabel }}</h1>
    <p>{{ placeholderMessage }}</p>
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
 * Description:     Sidebar tab for diary entries.
 *
 * END HEADER
 */

import { trans } from '@common/i18n-renderer'

const diaryLabel = trans('Diary')
const placeholderMessage = trans('Diary calendar coming soon.')
</script>
