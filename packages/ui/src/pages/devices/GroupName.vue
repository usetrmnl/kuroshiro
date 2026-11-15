<script setup lang="ts">
import type { DeviceGroup } from 'kuroshiro-shared'
import { ref, watch } from 'vue'
import { updateDeviceGroup } from '@/api/device-groups'
import SettingRow from '@/components/SettingRow.vue'
import TextInput from '@/components/TextInput.vue'
import { useSaveAsChanged } from '@/components/useSaveAsChanged'
import PageSection from '@/patterns/PageSection.vue'
import { useDevices } from '@/reads/sharedReads'
import { useDeviceGroupFrame } from './deviceGroupFrame'
import { groupNameProblem } from './deviceGroups'

const props = defineProps<{
  group: DeviceGroup
}>()

const { group: loaded } = useDeviceGroupFrame()
const devices = useDevices()

const name = ref(props.group.name)
const problem = ref<string>()

/** The Devices list names a Device's Group, so it follows a rename too. */
const save = useSaveAsChanged(async (entered: string) => {
  const saved = await updateDeviceGroup(props.group.id, { name: entered })
  await Promise.all([loaded.reload(), devices.reload()])
  return saved.name
}, name)

watch(() => props.group.name, (saved) => {
  if (save.status !== 'saving' && save.status !== 'failed')
    name.value = saved
})

function commit() {
  problem.value = groupNameProblem(name.value)
  if (problem.value) {
    save.reset()
    return
  }
  name.value = name.value.trim()
  if (name.value !== props.group.name)
    save.commit()
}
</script>

<template>
  <PageSection id="group" title="Group" rows>
    <SettingRow v-slot="{ control }" label="Name" :status="save.status" :reason="save.reason" :error="problem" @retry="save.retry">
      <TextInput v-model="name" v-bind="control" prose wide @update:model-value="problem = undefined" @commit="commit" />
    </SettingRow>
    <template #under>
      Every Device in the Group shows its Screens. Changes save as you make them.
    </template>
  </PageSection>
</template>
