<script setup lang="ts">
import { useTemplateRef } from 'vue'

defineProps<{
  /** The id of the title, which the section is labelled by. */
  id: string
  title: string
  /** How many there are, shown beside the title where a list is long enough to count. */
  count?: number
}>()

defineSlots<{
  /** What stands at the heading's right: the Order's save state, or the section's button. */
  default?: () => unknown
}>()

const heading = useTemplateRef('heading')

defineExpose({
  /** Takes the focus, for when the control that had it has gone. */
  focus: () => heading.value?.focus(),
})
</script>

<template>
  <div class="heading-line">
    <h2 ref="heading" class="heading" tabindex="-1">
      <span :id="id">{{ title }}</span> <span v-if="count !== undefined" class="count">{{ count }}</span>
    </h2>
    <slot />
  </div>
</template>

<style scoped>
@layer components {
  .heading-line {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-2) var(--space-4);
    padding-bottom: var(--space-2);
    border-bottom: var(--rule-heavy);
  }

  .heading {
    font-stretch: var(--width-title);
    font-weight: var(--weight-title);
    font-size: var(--title-sm);
    line-height: var(--leading-title);
  }

  .count {
    margin-left: var(--space-1);
    color: var(--color-ink-soft);
    font-family: var(--font-mono);
    font-stretch: 100%;
    font-weight: var(--weight-regular);
    font-size: var(--text-sm);
  }
}
</style>
