<script setup lang="ts">
import type { DeviceGroup } from 'kuroshiro-shared'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { deleteDeviceGroup } from '@/api/device-groups'
import Button from '@/components/Button.vue'
import Confirmation from '@/components/Confirmation.vue'
import PageSection from '@/patterns/PageSection.vue'
import { useDevices } from '@/reads/sharedReads'
import { DEVICES_PATH } from '@/shell/barEntries'
import { deleteGroupWording } from './deviceGroups'

const props = defineProps<{
  group: DeviceGroup
  screenCount: number
}>()

const router = useRouter()
const devices = useDevices()
const asking = ref(false)
const wording = computed(() => deleteGroupWording(props.group, props.screenCount))

/** The members show their own Screens again, which the Devices list says, so it is read again before it opens. */
async function remove() {
  await deleteDeviceGroup(props.group.id)
  await devices.reload()
}
</script>

<template>
  <PageSection id="delete" :title="`Delete ${group.name}`">
    <p class="sentence">
      Every Device in it goes back to its own Screens. The Group's Screens are deleted with it.
    </p>
    <div class="action">
      <Button @click="asking = true">
        Delete {{ group.name }}
      </Button>
    </div>
    <Confirmation v-model:open="asking" :title="wording.title" :confirm-label="`Delete ${group.name}`" :action="remove" @confirmed="router.push(DEVICES_PATH)">
      <template #lost>
        {{ wording.lost }}
      </template>
      <template #stays>
        {{ wording.stays }}
      </template>
    </Confirmation>
  </PageSection>
</template>

<style scoped>
@layer components {
  .sentence {
    margin-top: var(--space-4);
    max-width: 70ch;
    color: var(--color-ink-soft);
  }

  .action {
    margin-top: var(--space-4);
  }
}
</style>
