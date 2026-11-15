<script setup lang="ts">
import type { ScreenBody } from 'kuroshiro-shared'
import SaveState from '@/components/SaveState.vue'
import DitheringField from '@/patterns/DitheringField.vue'
import { useScreenDither } from './useScreenDither'

const props = defineProps<{
  screen: ScreenBody
  /** Reads the Screens again, after the switch was saved. */
  reload: () => Promise<void>
}>()

const { dither, save, switchTo } = useScreenDither(() => props.screen, props.reload)
</script>

<template>
  <DitheringField :model-value="dither" :saving="save.status === 'saving'" :error="save.status === 'failed'" @update:model-value="switchTo">
    <template #status>
      <SaveState :status="save.status" :reason="save.reason" @retry="save.retry" />
    </template>
  </DitheringField>
</template>
