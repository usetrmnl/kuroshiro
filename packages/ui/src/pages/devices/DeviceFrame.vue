<script setup lang="ts">
import type { NavItem } from '@/components/navItem'
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { getDevice } from '@/api/devices'
import { listScreens } from '@/api/screens'
import Button from '@/components/Button.vue'
import Tabs from '@/components/Tabs.vue'
import MissingPage from '@/patterns/MissingPage.vue'
import TitleLine from '@/patterns/TitleLine.vue'
import { useLoad } from '@/patterns/useLoad'
import { useDevices } from '@/reads/sharedReads'
import { DEVICES_PATH, MOST_DEVICES_NAMED } from '@/shell/barEntries'
import { provideDeviceFrame } from './deviceFrame'
import { addScreenPath, deviceLogsPath, devicePath, deviceSettingsPath } from './devicePaths'
import { deviceTarget, provideScreenTarget } from './screenTarget'

const route = useRoute()
const devices = useDevices()

const deviceId = computed(() => String(route.params.deviceId))
const device = useLoad(() => getDevice(deviceId.value), { key: () => route.params.deviceId, fresh: true })

const listed = computed(() => devices.data?.find(summary => summary.id === deviceId.value))
const name = computed(() => device.data?.name
  ?? listed.value?.name
  ?? 'Device')
const path = computed(() => devicePath(deviceId.value))

provideDeviceFrame({ device, listed, name, path })
provideScreenTarget({
  target: computed(() => device.data && deviceTarget(device.data)),
  name,
  path,
  waiting: computed(() => device.waiting),
  failure: computed(() => device.failure),
  reload: () => device.reload(),
  listScreens: () => listScreens(deviceId.value),
})

const views = computed<NavItem[]>(() => [
  { label: 'Screens', to: path.value },
  { label: 'Settings', to: deviceSettingsPath(deviceId.value) },
  { label: 'Logs', to: deviceLogsPath(deviceId.value) },
])

/** The bar stops naming the Devices from five on, so the way back to them stands above the title. */
const back = computed<NavItem | undefined>(() =>
  (devices.data?.length ?? 0) > MOST_DEVICES_NAMED ? { label: 'Devices', to: DEVICES_PATH } : undefined)

/** A Device in a Device Group shows the Group's Screens, which are added on the Group. */
const addsScreen = computed(() => route.path === path.value && !device.data?.deviceGroup && (device.data?.screenCount ?? 0) > 0)
</script>

<template>
  <MissingPage v-if="device.missing" title="No Device here" :back="{ label: 'All Devices', to: DEVICES_PATH }">
    It may have been deleted.
  </MissingPage>
  <template v-else>
    <TitleLine :title="name" :back="back">
      <template v-if="addsScreen" #actions>
        <Button as-child variant="primary">
          <RouterLink :to="addScreenPath(deviceId)">
            Add Screen
          </RouterLink>
        </Button>
      </template>
    </TitleLine>
    <Tabs :label="name" :items="views" />
    <RouterView />
  </template>
</template>
