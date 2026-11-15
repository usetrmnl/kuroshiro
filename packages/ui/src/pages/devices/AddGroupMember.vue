<script setup lang="ts">
import type { DeviceGroup } from 'kuroshiro-shared'
import { computed, ref, useId } from 'vue'
import { updateDevice } from '@/api/devices'
import Button from '@/components/Button.vue'
import { failureReason } from '@/components/failureReason'
import FieldError from '@/components/FieldError.vue'
import Select from '@/components/Select.vue'
import { useDevices } from '@/reads/sharedReads'
import { joinCandidates, joinNote } from './deviceGroups'

const props = defineProps<{
  group: DeviceGroup
  /** Reads the Group and its Screens again, after a Device joined. */
  reload: () => Promise<void>
}>()

const devices = useDevices()
const labelId = useId()
const noteId = useId()

const chosen = ref<string | null>(null)
const joining = ref(false)
const problem = ref<string>()

const candidates = computed(() => joinCandidates(devices.data ?? [], props.group))
const chosenDevice = computed(() => devices.data?.find(device => device.id === chosen.value))
const note = computed(() => joinNote(props.group.name, chosenDevice.value?.deviceGroup ?? undefined))

/** The Devices list names a Device's Group, so it is read again too. */
async function join() {
  const deviceId = chosen.value
  if (!deviceId)
    return
  joining.value = true
  problem.value = undefined
  try {
    await updateDevice(deviceId, { deviceGroupId: props.group.id })
    chosen.value = null
    await Promise.all([props.reload(), devices.reload()])
  }
  catch (error) {
    problem.value = failureReason(error) ?? 'The Device could not join.'
  }
  finally {
    joining.value = false
  }
}
</script>

<template>
  <div class="add-member" role="group" :aria-labelledby="labelId">
    <p :id="labelId" class="label">
      Add a Device
    </p>
    <p v-if="candidates.length === 0" class="note">
      Every Device is in this Group already.
    </p>
    <template v-else>
      <div class="controls">
        <Select v-model="chosen" :options="candidates" placeholder="Choose a Device" :aria-labelledby="labelId" :aria-describedby="noteId" />
        <Button :disabled="!chosen" :loading="joining" @click="join">
          Add to {{ group.name }}
        </Button>
      </div>
      <p :id="noteId" class="note">
        {{ note }}
      </p>
      <FieldError :message="problem" />
    </template>
  </div>
</template>

<style scoped>
@layer components {
  .add-member {
    display: grid;
    gap: var(--space-2);
    margin-top: var(--space-6);
  }

  .label {
    font-weight: var(--weight-medium);
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
  }

  .note {
    max-width: 70ch;
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }
}
</style>
