<script setup lang="ts">
import type { DeviceDetail, ScreenRead } from 'kuroshiro-shared'
import { computed } from 'vue'
import { imageUrl } from '@/api/client'
import Plate from '@/components/Plate.vue'
import RelativeTime from '@/patterns/RelativeTime.vue'
import { useNow } from '@/patterns/useNow'
import { useServerTimezone } from '@/reads/sharedReads'
import OpenedScreenParts from './OpenedScreenParts.vue'
import { screenName } from './screenNaming'
import { screenWhy } from './screenWording'

const props = withDefaults(defineProps<{
  screen: ScreenRead
  /** The Device's Screens in the Order the rows stand in. */
  screens: ScreenRead[]
  device: DeviceDetail
  /** Whether the Screen can jump to the top and to the end of the Order, as on a Device with many Screens. */
  jumps?: boolean
  /** What the Screen is made from has changed since its image was rendered, so the preview shows the rendering plate. */
  rendering?: boolean
  /** Whether the Screen can be moved in the Order from here; not on a Device that shows its Device Group's Screens. */
  movable?: boolean
}>(), {
  movable: true,
})

defineEmits<{
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

const now = useNow()
const timezone = useServerTimezone()

const name = computed(() => screenName(props.screen.name))
const why = computed(() => screenWhy({ screen: props.screen, screens: props.screens, device: props.device, now: now.value, timezone: timezone.value }))

const CAPTIONS_OF_KIND: Partial<Record<ScreenRead['kind'], (device: DeviceDetail) => string>> = {
  file: () => 'The converted image',
  html: device => `As ${device.name} renders it`,
}
const caption = computed(() => props.screen.imagePath
  ? CAPTIONS_OF_KIND[props.screen.kind]?.(props.device)
  : 'Not rendered yet. It renders when its turn first comes.')

const place = computed(() => props.screens.findIndex(screen => screen.id === props.screen.id))
</script>

<template>
  <div class="opened-screen">
    <p v-for="(line, index) in why" :key="line" class="why" :class="{ also: index > 0 }">
      {{ line }}
    </p>
    <figure class="preview">
      <Plate
        :name="`${name}, as rendered for ${device.name}`"
        :src="screen.imagePath && imageUrl(screen.imagePath)"
        :width="device.deviceModel?.width"
        :height="device.deviceModel?.height"
        :rendering="rendering"
      />
      <figcaption class="caption">
        <template v-if="caption">
          {{ caption }}
        </template>
        <template v-else-if="screen.renderedAt">
          Rendered <RelativeTime :at="screen.renderedAt" />
        </template>
      </figcaption>
    </figure>
    <OpenedScreenParts :place="place" :total="screens.length" :jumps="jumps" :movable="movable" @move="by => $emit('move', by)">
      <template #schedule>
        <slot name="schedule" />
      </template>
      <template #source>
        <slot name="source" />
      </template>
      <template #actionsBefore>
        <slot name="actionsBefore" />
      </template>
      <template #actionsAfter>
        <slot name="actionsAfter" />
      </template>
    </OpenedScreenParts>
  </div>
</template>

<style scoped>
@layer components {
  .opened-screen {
    display: grid;
    grid-template-columns: 18.5rem minmax(0, 1fr);
    align-items: start;
    gap: var(--space-4) var(--space-8);
  }

  .why {
    grid-column: 1 / -1;
    max-width: 70ch;
  }

  .why.also {
    margin-top: calc(var(--space-2) * -1);
    color: var(--color-ink-soft);
  }

  .caption {
    margin-top: var(--space-2);
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }

  @media (max-width: 820px) {
    .opened-screen {
      grid-template-columns: minmax(0, 1fr);
    }

    .preview {
      max-width: 18.5rem;
    }
  }
}
</style>
