<script setup lang="ts">
import { nextTick, ref, useTemplateRef } from 'vue'
import { listDeviceGroups } from '@/api/device-groups'
import Button from '@/components/Button.vue'
import LoadBody from '@/patterns/LoadBody.vue'
import { useLoad } from '@/patterns/useLoad'
import WashBar from '@/patterns/WashBar.vue'
import DeviceGroupRow from './DeviceGroupRow.vue'
import NewGroupForm from './NewGroupForm.vue'
import ScreensHeading from './ScreensHeading.vue'

const groups = useLoad(listDeviceGroups, { fresh: true })

const adding = ref(false)
const opener = useTemplateRef('opener')

async function close() {
  adding.value = false
  await nextTick()
  opener.value?.$el.focus()
}

const LOADING_WIDTHS = ['34%', '26%']
</script>

<template>
  <section class="device-groups" aria-labelledby="device-groups-heading">
    <ScreensHeading id="device-groups-heading" title="Device Groups">
      <Button v-if="!adding" ref="opener" @click="adding = true">
        New Group
      </Button>
    </ScreensHeading>
    <NewGroupForm v-if="adding" @close="close" />
    <LoadBody :load="groups" loading="Loading Device Groups" failed="Could not load the Device Groups.">
      <template #default="{ data }">
        <ul v-if="data.length > 0" class="groups">
          <DeviceGroupRow v-for="group in data" :key="group.id" :group="group" />
        </ul>
        <p v-else class="none">
          No Device Groups yet. A Group is one set of Screens that several Devices show together, each at its own pace.
        </p>
      </template>
      <template #skeleton>
        <div class="groups" aria-hidden="true">
          <div v-for="width in LOADING_WIDTHS" :key="width" class="loading-row">
            <WashBar :width="width" />
          </div>
        </div>
      </template>
    </LoadBody>
  </section>
</template>

<style scoped>
@layer components {
  .device-groups {
    margin-top: var(--space-12);
  }

  .none {
    padding: var(--space-4) 0;
    max-width: 70ch;
    color: var(--color-ink-soft);
  }

  .loading-row {
    padding: var(--space-4) 0;
    border-bottom: var(--rule);
  }
}
</style>
