<script setup lang="ts">
import type { DeviceGroup, GroupScreen } from 'kuroshiro-shared'
import { joinLoads } from '@/patterns/joinLoads'
import LoadBody from '@/patterns/LoadBody.vue'
import { useDeviceGroupFrame } from './deviceGroupFrame'
import GroupDeletion from './GroupDeletion.vue'
import GroupMembers from './GroupMembers.vue'
import GroupName from './GroupName.vue'
import GroupScreensInOrder from './GroupScreensInOrder.vue'
import GroupScreensLoading from './GroupScreensLoading.vue'
import { useScreenTarget } from './screenTarget'

const { group, screens, name } = useDeviceGroupFrame()
const { reload } = useScreenTarget()

const page = joinLoads<{ group: DeviceGroup, screens: GroupScreen[] }>({ group, screens })
</script>

<template>
  <div class="device-group">
    <LoadBody :load="page" :loading="`Loading ${name}`" :failed="`Could not load ${name}.`">
      <template #skeleton>
        <GroupScreensLoading />
      </template>
      <template #default="{ data }">
        <p class="lede">
          One set of Screens, shown by every Device in the Group. Each Device renders them for its own Device Model and Palette and walks the Order at its own pace.
        </p>
        <GroupName class="first" :group="data.group" />
        <GroupMembers :group="data.group" :reload="reload" />
        <GroupScreensInOrder :group="data.group" :screens="data.screens" :reload="screens.reload" />
        <GroupDeletion :group="data.group" :screen-count="data.screens.length" />
      </template>
    </LoadBody>
  </div>
</template>

<style scoped>
@layer components {
  .device-group {
    margin-top: var(--space-8);
  }

  .lede {
    color: var(--color-ink-soft);
  }

  .first {
    margin-top: var(--space-8);
  }

  @media (max-width: 820px) {
    .device-group,
    .first {
      margin-top: var(--space-6);
    }
  }
}
</style>
