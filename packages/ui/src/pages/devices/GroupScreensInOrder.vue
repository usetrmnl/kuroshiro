<script setup lang="ts">
import type { DeviceGroup, GroupScreen } from 'kuroshiro-shared'
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import { RouterLink } from 'vue-router'
import { imageUrl } from '@/api/client'
import { reorderGroupScreens } from '@/api/device-groups'
import Button from '@/components/Button.vue'
import EmptyState from '@/components/EmptyState.vue'
import Plate from '@/components/Plate.vue'
import SaveState from '@/components/SaveState.vue'
import ScreenRow from '@/components/ScreenRow.vue'
import { SCREEN_KIND_LABELS } from '@/components/screenRows'
import ScreenRows from '@/components/ScreenRows.vue'
import { useDeviceGroupFrame } from './deviceGroupFrame'
import { memberChips, newestRenderOf, rowStateOf, thumbnailOf } from './deviceGroups'
import GroupOpenedScreen from './GroupOpenedScreen.vue'
import RowSchedule from './RowSchedule.vue'
import ScheduleEditor from './ScheduleEditor.vue'
import { possessive, screenName } from './screenNaming'
import ScreenRemoval from './ScreenRemoval.vue'
import ScreenRename from './ScreenRename.vue'
import ScreensHeading from './ScreensHeading.vue'
import ScreenSource from './ScreenSource.vue'
import { addScreenPathOf, groupTarget } from './screenTarget'
import { screenRowId, useScreensInOrder } from './useScreensInOrder'

const props = defineProps<{
  group: DeviceGroup
  /** The Group's Screens in Order, as the server has them. */
  screens: GroupScreen[]
  /** Reads the Screens again, after a write to one of them. */
  reload: () => Promise<void>
}>()

const { path } = useDeviceGroupFrame()

const target = computed(() => groupTarget(props.group))

const list = useScreensInOrder(() => props.screens.map(screen => ({ ...screen, renderedAt: newestRenderOf(screen) })), async (ids) => {
  await reorderGroupScreens(props.group.id, { screenIds: ids })
  await props.reload()
})

const memberModel = (deviceId: string | undefined) => props.group.members.find(member => member.id === deviceId)?.deviceModel

const rows = computed(() => list.ordered.map((screen) => {
  const thumbnail = thumbnailOf(screen)
  return {
    ...screen,
    name: screenName(screen.name),
    savedName: screen.name,
    rowState: rowStateOf(screen),
    chips: memberChips(screen, props.group.members),
    thumbnail,
    thumbnailModel: memberModel(thumbnail?.deviceId),
    renderingFor: renderingFor(screen),
  }
}))

/** For each Screen changed since it was rendered, when each member's rendering was made: a member shows the rendering plate until its own render moves. */
const outdatedRenders = ref<Record<string, Record<string, string | null>>>({})

function awaitRendering(screen: GroupScreen) {
  outdatedRenders.value = { ...outdatedRenders.value, [screen.id]: Object.fromEntries(screen.perDevice.map(member => [member.deviceId, member.renderedAt])) }
}

function renderingFor(screen: GroupScreen): Record<string, boolean> {
  const outdated = outdatedRenders.value[screen.id]
  return Object.fromEntries(screen.perDevice.map(member => [member.deviceId, outdated !== undefined && member.deviceId in outdated && outdated[member.deviceId] === member.renderedAt]))
}

const heading = useTemplateRef('heading')

/** The removed row held the focus, which the heading takes. */
async function showWithoutRemoved() {
  list.open = undefined
  await props.reload()
  await nextTick()
  heading.value?.focus()
}
</script>

<template>
  <EmptyState v-if="screens.length === 0" class="no-screens" :title="`Add ${possessive(group.name)} first Screen`" heading="h2">
    A Screen is one thing the Devices show: a Plugin, a Mashup, an image from a link or a file, or HTML you write. Every Device in {{ group.name }} shows the same Screens, each at its own pace.
    <template #action>
      <Button as-child variant="primary">
        <RouterLink :to="addScreenPathOf(path)">
          Add Screen
        </RouterLink>
      </Button>
    </template>
  </EmptyState>
  <section v-else class="screens-in-order" aria-labelledby="group-screens-heading">
    <ScreensHeading id="group-screens-heading" ref="heading" title="Screens in Order" :count="list.isMany ? screens.length : undefined">
      <SaveState :status="list.orderSave.status" :reason="list.orderSave.reason" @retry="list.orderSave.retry" />
    </ScreensHeading>
    <p v-if="group.members.length === 0" class="nobody">
      No Device shows these Screens yet. Add a Device to the Group above.
    </p>
    <ScreenRows v-model:open="list.open" :items="rows" sortable @reorder="list.reorder">
      <template #default="{ item }">
        <ScreenRow
          :id="screenRowId(item.id)"
          class="row"
          :value="item.id"
          :name="item.name"
          :kind="SCREEN_KIND_LABELS[item.kind]"
          :state="item.rowState"
          :passed-over="false"
          :renaming="list.renaming === item.id"
        >
          <template v-if="item.kind !== 'plugin'" #rename>
            <ScreenRename :screen-id="item.id" :name="item.savedName" :reload="reload" :editing="list.renaming === item.id" @update:editing="isRenaming => list.setRenaming(item.id, isRenaming)" />
          </template>
          <template #thumbnail>
            <Plate
              :name="`${item.name}, as last rendered`"
              :src="item.thumbnail?.imagePath && imageUrl(item.thumbnail.imagePath)"
              size="row"
              :width="item.thumbnailModel?.width"
              :height="item.thumbnailModel?.height"
              lazy
            />
          </template>
          <template #schedule>
            <RowSchedule :screen="item" :reload="reload" />
          </template>
          <template #state>
            <span class="chips">
              <template v-for="(chip, index) in item.chips" :key="chip.deviceId">
                <template v-if="index > 0">
                  ·
                </template>
                <span>{{ chip.text }}</span>
              </template>
            </span>
          </template>
          <GroupOpenedScreen :screen="item" :screens="rows" :group="group" :jumps="list.isMany" :rendering-for="item.renderingFor" :reload="reload" @move="by => list.move(item.id, by)">
            <template #schedule>
              <ScheduleEditor :screen="item" :reload="reload" />
            </template>
            <template #source>
              <ScreenSource :screen="item" :image-path="item.thumbnail?.imagePath ?? null" :rendered-at="item.renderedAt" :renders-as="target.rendersAs" :reload="reload" @rerendering="awaitRendering(item)" />
            </template>
            <template v-if="item.kind !== 'plugin'" #actionsBefore>
              <Button variant="quiet" :disabled="list.renaming === item.id" @click="list.setRenaming(item.id, true)">
                Rename
              </Button>
            </template>
            <template #actionsAfter>
              <ScreenRemoval :screen="item" :owner="target.owner" :owner-name="group.name" @removed="showWithoutRemoved" />
            </template>
          </GroupOpenedScreen>
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

  .nobody {
    padding: var(--space-3) 0;
    border-bottom: var(--rule);
    color: var(--color-ink);
  }

  /* A row the address names is scrolled to, and stops below the bar. */
  .screens-in-order .row {
    scroll-margin-top: calc(var(--bar-height) + var(--space-4));
  }

  .chips {
    font-weight: var(--weight-regular);
  }
}
</style>
