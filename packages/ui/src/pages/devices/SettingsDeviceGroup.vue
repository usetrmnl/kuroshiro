<script setup lang="ts">
import type { DeviceDetail, DeviceGroupSummary } from 'kuroshiro-shared'
import type { SelectOption } from '@/components/selectOption'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import Select from '@/components/Select.vue'
import SettingRow from '@/components/SettingRow.vue'
import { DEVICES_PATH } from '@/shell/barEntries'
import { deviceGroupPath } from './deviceGroupPaths'
import { linkTo, sentence } from './sentence'
import { useDeviceSetting } from './useDeviceSetting'

const props = defineProps<{
  device: DeviceDetail
  groups: DeviceGroupSummary[]
}>()

/** The option that is no Group: a select's value is never the empty string. */
const NONE = 'none'

const options = computed<SelectOption[]>(() => [
  { value: NONE, label: 'None' },
  ...props.groups.map(group => ({ value: group.id, label: group.name })),
])

const saved = () => props.device.deviceGroup?.id ?? NONE

const group = useDeviceSetting<string>(saved, chosen =>
  chosen === saved() ? undefined : { deviceGroupId: chosen === NONE ? null : chosen })

const note = computed(() => {
  const { deviceGroup, name } = props.device
  if (deviceGroup)
    return sentence(`${name} shows `, linkTo(deviceGroup.name, deviceGroupPath(deviceGroup.id)), '\'s Screens; its own are parked until it leaves. Joining or leaving starts the Order from the first Screen.')
  if (props.groups.length > 0)
    return sentence(`${name} shows its own Screens. In a Group it shows the Group's instead and parks its own; joining starts the Group's Order from the first Screen.`)
  return sentence('No Device Groups yet. Make one from the ', linkTo('Devices list', DEVICES_PATH), '.')
})
</script>

<template>
  <SettingRow label="Device Group" :status="group.status" :reason="group.reason" @retry="group.retry">
    <template #default="{ control }">
      <Select v-bind="control" :model-value="group.entered" :options="options" @update:model-value="group.choose($event ?? NONE)" />
    </template>
    <template #note>
      <template v-for="(part, index) in note" :key="index">
        <RouterLink v-if="part.to" v-slot="{ href, navigate }" custom :to="part.to">
          <a class="link" :href="href" @click="navigate">{{ part.text }}</a>
        </RouterLink>
        <span v-else>{{ part.text }}</span>
      </template>
    </template>
  </SettingRow>
</template>
