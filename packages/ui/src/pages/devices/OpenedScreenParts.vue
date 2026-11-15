<script setup lang="ts">
import { computed, nextTick, useTemplateRef, watch } from 'vue'
import Button from '@/components/Button.vue'
import { moveActions } from './screenMoves'

const props = withDefaults(defineProps<{
  /** The Screen's place in the Order, from 0, among `total`. */
  place: number
  total: number
  /** Whether the Screen can jump to the top and to the end of the Order, as on a long Order. */
  jumps?: boolean
  /** Whether the Screen can be moved in the Order from here; not on a Device that shows its Device Group's Screens. */
  movable?: boolean
}>(), {
  movable: true,
})

const emit = defineEmits<{
  /** The Screen is to move by so many places in the Order; an infinite number is the top or the end. */
  move: [by: number]
}>()

defineSlots<{
  /** The Schedule editor. */
  schedule?: () => unknown
  /** What the Screen is made from, by its kind. */
  source?: () => unknown
  /** The actions before the move buttons: "Rename". */
  actionsBefore?: () => unknown
  /** The destructive action, after the move buttons. */
  actionsAfter?: () => unknown
}>()

const moves = computed(() => props.movable ? moveActions(props.place, props.total, props.jumps ?? false) : [])

const actions = useTemplateRef('actions')
let movedFromHere = false

function move(by: number) {
  movedFromHere = true
  emit('move', by)
}

// A move button that has reached the end of the Order is disabled and drops the focus, which the next one takes.
watch(() => props.place, async () => {
  if (!movedFromHere)
    return
  movedFromHere = false
  await nextTick()
  if (!actions.value?.contains(document.activeElement))
    actions.value?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
}, { flush: 'post' })
</script>

<template>
  <div class="parts">
    <slot name="schedule" />
    <div class="made-from">
      <slot name="source" />
      <div ref="actions" class="actions">
        <slot name="actionsBefore" />
        <Button v-for="action in moves" :key="action.label" variant="quiet" :disabled="action.disabled" @click="move(action.by)">
          {{ action.label }}
        </Button>
        <slot name="actionsAfter" />
      </div>
    </div>
  </div>
</template>

<style scoped>
@layer components {
  /* The Schedule beside what the Screen is made from, and above it where the two do not fit side by side. */
  .parts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr));
    align-items: start;
    gap: var(--space-6) var(--space-8);
    min-width: 0;
  }

  .made-from {
    display: grid;
    gap: var(--space-6);
    min-width: 0;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-4);
  }

  .actions:not(:first-child) {
    padding-top: var(--space-4);
    border-top: var(--rule);
  }

  /* A Screen a Device shows from its Group may have no action at all: then there is no rule for them either. */
  .actions:empty {
    display: none;
  }
}
</style>
