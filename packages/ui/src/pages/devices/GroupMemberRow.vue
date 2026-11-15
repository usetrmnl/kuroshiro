<script setup lang="ts">
import type { DeviceGroup, DeviceGroupMember } from 'kuroshiro-shared'
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { updateDevice } from '@/api/devices'
import Button from '@/components/Button.vue'
import Confirmation from '@/components/Confirmation.vue'
import { useDevices } from '@/reads/sharedReads'
import { leaveGroupWording, memberFacts } from './deviceGroups'
import { devicePath } from './devicePaths'

const props = defineProps<{
  member: DeviceGroupMember
  group: DeviceGroup
  /** Reads the Group and its Screens again, after the Device left. */
  reload: () => Promise<void>
}>()

const devices = useDevices()
const asking = ref(false)
const facts = computed(() => memberFacts(props.member))
const wording = computed(() => leaveGroupWording(props.member, props.group))

/** The Devices list names a Device's Group, so it is read again too. */
async function leave() {
  await updateDevice(props.member.id, { deviceGroupId: null })
  await Promise.all([props.reload(), devices.reload()])
}
</script>

<template>
  <li class="member-row">
    <div class="said">
      <h3 class="name">
        <RouterLink :to="devicePath(member.id)">
          {{ member.name }}
        </RouterLink>
      </h3>
      <p v-if="facts" class="facts">
        {{ facts }}
      </p>
    </div>
    <Button @click="asking = true">
      Remove
    </Button>
    <Confirmation v-model:open="asking" :title="wording.title" confirm-label="Remove" :action="leave">
      {{ wording.sentence }}
    </Confirmation>
  </li>
</template>

<style scoped>
@layer components {
  .member-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2) var(--space-4);
    padding: var(--space-3) 0;
    border-bottom: var(--rule);
  }

  .said {
    min-width: 0;
  }

  .name {
    font-weight: var(--weight-semibold);
    font-size: var(--text-md);
    overflow-wrap: anywhere;
  }

  .facts {
    margin-top: var(--space-1);
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }
}
</style>
