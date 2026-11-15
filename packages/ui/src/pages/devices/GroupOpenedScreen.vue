<script setup lang="ts">
import type { DeviceGroup, GroupScreen } from 'kuroshiro-shared'
import { computed } from 'vue'
import { imageUrl } from '@/api/client'
import Plate from '@/components/Plate.vue'
import RelativeTime from '@/patterns/RelativeTime.vue'
import { memberStateWords } from './deviceGroups'
import OpenedScreenParts from './OpenedScreenParts.vue'
import { screenName } from './screenNaming'
import ScreenPick from './ScreenPick.vue'

const props = defineProps<{
  screen: GroupScreen
  /** The Group's Screens in the Order the rows stand in. */
  screens: GroupScreen[]
  group: DeviceGroup
  /** Whether the Screen can jump to the top and to the end of the Order, as on a Group with many Screens. */
  jumps?: boolean
  /** What the Screen is made from has changed since its image was rendered, so the previews show the rendering plate. */
  rendering?: boolean
  /** Reads the Screens again, after a member's pick changed. */
  reload: () => Promise<void>
}>()

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

const name = computed(() => screenName(props.screen.name))

/** Each member with how the Screen stands for it and its own rendering of it. A member is not mirrored or Proxied as far as the Group knows; "Show next" is offered where the Screen waits its turn. */
const members = computed(() => props.group.members.map((member) => {
  const state = props.screen.perDevice.find(candidate => candidate.deviceId === member.id)
  return {
    ...member,
    state: state?.state ?? null,
    picked: state?.picked ?? false,
    imagePath: state?.imagePath ?? null,
    renderedAt: state?.renderedAt ?? null,
    words: memberStateWords(state ?? { state: null, picked: false, renderSignal: null }),
    pickable: { id: member.id, isMirrored: false, isProxied: false },
  }
}))

const place = computed(() => props.screens.findIndex(screen => screen.id === props.screen.id))
</script>

<template>
  <div class="opened-screen">
    <p v-if="members.length === 0" class="why">
      No Device shows it yet: {{ group.name }} has no Device.
    </p>
    <ul v-else class="members" aria-label="On each Device">
      <li v-for="member in members" :key="member.id" class="member">
        <figure class="preview">
          <Plate
            :name="`${name}, as rendered for ${member.name}`"
            :src="member.imagePath && imageUrl(member.imagePath)"
            :width="member.deviceModel?.width"
            :height="member.deviceModel?.height"
            :rendering="rendering"
          />
          <figcaption class="caption">
            <template v-if="member.renderedAt">
              Rendered <RelativeTime :at="member.renderedAt" />
            </template>
            <template v-else>
              Not rendered yet. It renders when its turn first comes.
            </template>
          </figcaption>
        </figure>
        <p class="on">
          <b class="member-name">{{ member.name }}</b>
          <template v-if="member.words.words">
            · {{ member.words.words }}<span v-if="member.words.qualifier" class="qualifier"> · {{ member.words.qualifier }}</span>
          </template>
          <template v-else>
            · Waiting its turn
          </template>
        </p>
        <ScreenPick :screen-id="screen.id" :device="member.pickable" :state="member.state" :picked="member.picked" :reload="reload" />
      </li>
    </ul>
    <OpenedScreenParts :place="place" :total="screens.length" :jumps="jumps" @move="by => $emit('move', by)">
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
    gap: var(--space-6);
  }

  .why {
    max-width: 70ch;
  }

  .members {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr));
    gap: var(--space-5) var(--space-6);
  }

  .member {
    display: grid;
    gap: var(--space-2);
    align-content: start;
  }

  .caption,
  .qualifier {
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }

  .caption {
    margin-top: var(--space-2);
  }

  .member-name {
    font-weight: var(--weight-semibold);
  }
}
</style>
