<script setup lang="ts">
import type { DeviceModelReference } from 'kuroshiro-shared'
import Plate from '@/components/Plate.vue'
import LoadingLine from '@/patterns/LoadingLine.vue'
import WashBar from '@/patterns/WashBar.vue'
import HeroColumns from './HeroColumns.vue'
import { possessive } from './screenNaming'
import ScreenRowsSkeleton from './ScreenRowsSkeleton.vue'

defineProps<{
  deviceName: string
  /** Whether the answer has taken long enough for the loading state to show. */
  waiting: boolean
  /** The Device Model, where the Devices list already knows it: the shape of the plates. */
  deviceModel?: DeviceModelReference | null
}>()

const FACT_WIDTHS = ['60%', '40%', '52%', '46%']
</script>

<template>
  <HeroColumns class="screens-loading">
    <template #plate>
      <Plate
        v-if="waiting"
        size="current"
        :name="`On ${deviceName}`"
        :width="deviceModel?.width"
        :height="deviceModel?.height"
        rendering
      />
      <span v-else />
    </template>
    <LoadingLine :shown="waiting">
      Loading {{ possessive(deviceName) }} Screens
    </LoadingLine>
    <div v-if="waiting" class="facts" aria-hidden="true">
      <div v-for="width in FACT_WIDTHS" :key="width" class="fact">
        <WashBar :width="width" />
      </div>
    </div>
  </HeroColumns>
  <ScreenRowsSkeleton v-if="waiting" :device-model="deviceModel" />
</template>

<style scoped>
@layer components {
  .facts {
    margin-top: var(--space-5);
    border-top: var(--rule-heavy);
  }

  .fact {
    padding: var(--space-3) 0;
    border-bottom: var(--rule);
  }
}
</style>
