<script setup lang="ts">
import type { DeviceModelReference } from 'kuroshiro-shared'
import Plate from '@/components/Plate.vue'
import WashBar from '@/patterns/WashBar.vue'

defineProps<{
  /** The Device Model, where it is known: the shape of the plates. */
  deviceModel?: DeviceModelReference | null
}>()

const ROW_WIDTHS = ['38%', '30%', '44%']
</script>

<template>
  <div class="rows" aria-hidden="true">
    <p class="heading">
      Screens in Order
    </p>
    <div v-for="width in ROW_WIDTHS" :key="width" class="row">
      <Plate size="row" name="A Screen" :width="deviceModel?.width" :height="deviceModel?.height" rendering />
      <WashBar :width="width" />
    </div>
  </div>
</template>

<style scoped>
@layer components {
  .rows {
    margin-top: var(--space-10);
  }

  .heading {
    padding-bottom: var(--space-2);
    border-bottom: var(--rule-heavy);
    font-stretch: var(--width-title);
    font-weight: var(--weight-title);
    font-size: var(--title-sm);
    line-height: var(--leading-title);
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: var(--hit-target);
    padding: var(--space-2) 0 var(--space-2) calc(1rem + 1.25rem + 2 * var(--space-3));
    border-bottom: var(--rule);
  }

  @media (max-width: 820px) {
    .row {
      padding-left: 0;
    }
  }
}
</style>
