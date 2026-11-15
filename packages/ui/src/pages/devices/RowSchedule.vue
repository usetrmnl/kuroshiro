<script setup lang="ts">
import type { ScreenBody } from 'kuroshiro-shared'
import ScheduleSummary from './ScheduleSummary.vue'
import ScheduleSwitch from './ScheduleSwitch.vue'

defineProps<{
  /** The Screen, under the name the admin reads it by. */
  screen: Pick<ScreenBody, 'id' | 'name' | 'schedule'>
  /** Reads the Screens again, after a write to this one. */
  reload: () => Promise<void>
  /** The Schedule is edited elsewhere (on the Device Group): the summary alone, without the switch. */
  readOnly?: boolean
}>()
</script>

<template>
  <ScheduleSwitch v-if="screen.schedule && !readOnly" :screen-id="screen.id" :enabled="screen.schedule.enabled" :label="`Schedule for ${screen.name}`" :reload="reload">
    <ScheduleSummary :schedule="screen.schedule" />
  </ScheduleSwitch>
  <ScheduleSummary v-else :schedule="screen.schedule" />
</template>
