<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { getDeviceGroup, listGroupScreens } from '@/api/device-groups'
import Button from '@/components/Button.vue'
import MissingPage from '@/patterns/MissingPage.vue'
import TitleLine from '@/patterns/TitleLine.vue'
import { useLoad } from '@/patterns/useLoad'
import { DEVICES_PATH } from '@/shell/barEntries'
import { provideDeviceGroupFrame } from './deviceGroupFrame'
import { deviceGroupPath } from './deviceGroupPaths'
import { addScreenPathOf, groupTarget, provideScreenTarget } from './screenTarget'

const route = useRoute()

const groupId = computed(() => String(route.params.groupId))
const group = useLoad(() => getDeviceGroup(groupId.value), { key: () => route.params.groupId, fresh: true })
const screens = useLoad(() => listGroupScreens(groupId.value), { key: () => route.params.groupId, fresh: true })

const name = computed(() => group.data?.name ?? 'Device Group')
const path = computed(() => deviceGroupPath(groupId.value))

provideDeviceGroupFrame({ group, screens, name, path })
provideScreenTarget({
  target: computed(() => group.data && groupTarget(group.data)),
  name,
  path,
  waiting: computed(() => group.waiting),
  failure: computed(() => group.failure),
  reload: async () => {
    await Promise.all([group.reload(), screens.reload()])
  },
  listScreens: () => listGroupScreens(groupId.value),
})

const back = { label: 'Devices', to: DEVICES_PATH }
const addsScreen = computed(() => route.path === path.value && (screens.data?.length ?? 0) > 0)
</script>

<template>
  <MissingPage v-if="group.missing" title="No Device Group here" :back="{ label: 'All Devices', to: DEVICES_PATH }">
    It may have been deleted.
  </MissingPage>
  <template v-else>
    <TitleLine :title="name" :back="back">
      <template v-if="addsScreen" #actions>
        <Button as-child variant="primary">
          <RouterLink :to="addScreenPathOf(path)">
            Add Screen
          </RouterLink>
        </Button>
      </template>
    </TitleLine>
    <RouterView />
  </template>
</template>
