<script setup lang="ts">
import type { DeviceDetail, ScreenRead } from 'kuroshiro-shared'
import { computed, nextTick, useTemplateRef } from 'vue'
import { RouterLink } from 'vue-router'
import { imageUrl } from '@/api/client'
import { reorderScreens } from '@/api/screens'
import Button from '@/components/Button.vue'
import EmptyState from '@/components/EmptyState.vue'
import Plate from '@/components/Plate.vue'
import SaveState from '@/components/SaveState.vue'
import ScreenRow from '@/components/ScreenRow.vue'
import { isPassedOver, SCREEN_KIND_LABELS } from '@/components/screenRows'
import ScreenRows from '@/components/ScreenRows.vue'
import { useDeviceFrame } from './deviceFrame'
import { deviceGroupPath } from './deviceGroupPaths'
import { addScreenPath, deviceSettingsPath } from './devicePaths'
import OpenedScreen from './OpenedScreen.vue'
import RowSchedule from './RowSchedule.vue'
import ScheduleEditor from './ScheduleEditor.vue'
import ScheduleSummary from './ScheduleSummary.vue'
import { possessive, screenName } from './screenNaming'
import ScreenPick from './ScreenPick.vue'
import ScreenRemoval from './ScreenRemoval.vue'
import ScreenRename from './ScreenRename.vue'
import ScreensHeading from './ScreensHeading.vue'
import ScreenSource from './ScreenSource.vue'
import ScreenSourceReadOnly from './ScreenSourceReadOnly.vue'
import { screenStateWords } from './screenWording'
import { linkTo, sentence } from './sentence'
import SentenceLine from './SentenceLine.vue'
import { screenRowId, useScreensInOrder } from './useScreensInOrder'

const props = defineProps<{
  device: DeviceDetail
  /** The Screens the Device shows in Order, as the server has them: its Device Group's while it is a member, its own otherwise. */
  screens: ScreenRead[]
  /** Reads the Screens again, after the Order has changed. */
  reload: () => Promise<void>
}>()

/** The Screens are the Device Group's: read here with this Device's state, edited on the Group. "Show next" still picks for this Device. */
const group = computed(() => props.device.deviceGroup)
const readOnly = computed(() => group.value !== null)

const list = useScreensInOrder(() => props.screens, async (ids) => {
  await reorderScreens(props.device.id, { screenIds: ids })
  await props.reload()
})

const rows = computed(() => list.ordered.map(screen => ({
  ...screen,
  name: screenName(screen.name),
  savedName: screen.name,
  stateWords: screenStateWords(screen, props.device),
})))

const frame = useDeviceFrame()
const heading = useTemplateRef('heading')

/** The Device counts its Screens, so it is read again too. The removed row held the focus, which the heading takes. */
async function showWithoutRemoved() {
  list.open = undefined
  await Promise.all([props.reload(), frame.device.reload()])
  await nextTick()
  heading.value?.focus()
}

const pausedNote = computed(() => sentence(
  'Rotation is paused while Mirroring is on. These Screens are kept and can still be edited; they return when you switch Mirroring off in ',
  linkTo('Settings', deviceSettingsPath(props.device.id)),
  '.',
))

const fromGroupNote = computed(() => group.value && sentence(
  'Screens from ',
  linkTo(group.value.name, deviceGroupPath(group.value.id)),
  `, shown by every Device in it. They are edited there; ${props.device.name} walks the Order at its own pace.`,
))
</script>

<template>
  <EmptyState v-if="screens.length === 0 && group" class="no-screens" :title="`No Screens in ${group.name} yet`">
    {{ device.name }} shows {{ possessive(group.name) }} Screens, and the Group has none yet. Add one on the Group and every Device in it shows it.
    <template #action>
      <Button as-child variant="primary">
        <RouterLink :to="deviceGroupPath(group.id)">
          Open {{ group.name }}
        </RouterLink>
      </Button>
    </template>
  </EmptyState>
  <EmptyState v-else-if="screens.length === 0" class="no-screens" :title="`Add ${possessive(device.name)} first Screen`">
    A Screen is one thing the Device shows: a Plugin, a Mashup, an image from a link or a file, or HTML you write. With more than one, {{ device.name }} steps through them in Order, one per poll.
    <template #action>
      <Button as-child variant="primary">
        <RouterLink :to="addScreenPath(device.id)">
          Add Screen
        </RouterLink>
      </Button>
    </template>
  </EmptyState>
  <section v-else class="screens-in-order" aria-labelledby="screens-in-order-heading">
    <ScreensHeading id="screens-in-order-heading" ref="heading" title="Screens in Order" :count="list.isMany ? screens.length : undefined">
      <SaveState :status="list.orderSave.status" :reason="list.orderSave.reason" @retry="list.orderSave.retry" />
    </ScreensHeading>
    <SentenceLine v-if="fromGroupNote" class="note from-group" :sentence="fromGroupNote" />
    <SentenceLine v-if="device.isMirrored" class="note paused" :sentence="pausedNote" />
    <ScreenRows v-model:open="list.open" :items="rows" :sortable="!readOnly" @reorder="list.reorder">
      <template #default="{ item }">
        <ScreenRow
          :id="screenRowId(item.id)"
          class="row"
          :value="item.id"
          :name="item.name"
          :kind="SCREEN_KIND_LABELS[item.kind]"
          :state="item.state"
          :passed-over="device.isMirrored || undefined"
          :renaming="list.renaming === item.id"
        >
          <template v-if="item.kind !== 'plugin' && !readOnly" #rename>
            <ScreenRename :screen-id="item.id" :name="item.savedName" :reload="reload" :editing="list.renaming === item.id" @update:editing="isRenaming => list.setRenaming(item.id, isRenaming)" />
          </template>
          <template #thumbnail>
            <Plate
              :name="`${item.name}, as last rendered`"
              :src="item.imagePath && imageUrl(item.imagePath)"
              size="row"
              :width="device.deviceModel?.width"
              :height="device.deviceModel?.height"
              :passed-over="isPassedOver(item.state)"
              lazy
            />
          </template>
          <template #schedule>
            <RowSchedule :screen="item" :reload="reload" :read-only="readOnly" />
          </template>
          <template #state>
            <span>{{ item.stateWords.words }}<span v-if="item.stateWords.qualifier" class="qualifier"> · {{ item.stateWords.qualifier }}</span></span>
          </template>
          <OpenedScreen :screen="item" :screens="rows" :device="device" :jumps="list.isMany" :rendering="list.isOutdated(item)" :movable="!readOnly" @move="by => list.move(item.id, by)">
            <template #schedule>
              <ScheduleEditor v-if="!readOnly" :screen="item" :reload="reload" />
              <div v-else class="schedule-read" role="group" :aria-labelledby="`${screenRowId(item.id)}-schedule`">
                <h4 :id="`${screenRowId(item.id)}-schedule`" class="schedule-heading">
                  Schedule
                </h4>
                <ScheduleSummary :schedule="item.schedule" />
              </div>
            </template>
            <template #source>
              <ScreenSourceReadOnly v-if="group" :screen="item" :group="group" />
              <ScreenSource v-else :screen="item" :image-path="item.imagePath" :rendered-at="item.renderedAt" :renders-as="device" :reload="reload" @rerendering="list.awaitRendering(item)" />
            </template>
            <template v-if="item.kind !== 'plugin' && !readOnly" #actionsBefore>
              <Button variant="quiet" :disabled="list.renaming === item.id" @click="list.setRenaming(item.id, true)">
                Rename
              </Button>
            </template>
            <template #actionsAfter>
              <ScreenPick :screen-id="item.id" :device="device" :state="item.state" :picked="item.picked" :reload="reload" />
              <ScreenRemoval v-if="!readOnly" :screen="item" :owner="{ kind: 'device', id: device.id }" :owner-name="device.name" @removed="showWithoutRemoved" />
            </template>
          </OpenedScreen>
        </ScreenRow>
      </template>
    </ScreenRows>
  </section>
</template>

<style scoped>
@layer components {
  .no-screens,
  .screens-in-order {
    margin-top: var(--space-10);
  }

  .screens-in-order .note {
    padding: var(--space-3) 0;
    border-bottom: var(--rule);
    color: var(--color-ink);
  }

  /* A row the address names is scrolled to, and stops below the bar. */
  .screens-in-order .row {
    scroll-margin-top: calc(var(--bar-height) + var(--space-4));
  }

  .qualifier {
    color: var(--color-ink-soft);
    font-weight: var(--weight-regular);
  }

  .schedule-read {
    display: grid;
    gap: var(--space-3);
  }

  .schedule-heading {
    margin: 0;
    font-weight: var(--weight-semibold);
    font-size: var(--text-md);
  }
}
</style>
