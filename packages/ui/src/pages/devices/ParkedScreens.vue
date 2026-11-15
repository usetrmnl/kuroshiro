<script setup lang="ts">
import type { DeviceDetail } from 'kuroshiro-shared'
import { computed, ref } from 'vue'
import { imageUrl } from '@/api/client'
import { listOwnScreens } from '@/api/screens'
import Plate from '@/components/Plate.vue'
import ScreenRow from '@/components/ScreenRow.vue'
import { SCREEN_KIND_LABELS } from '@/components/screenRows'
import ScreenRows from '@/components/ScreenRows.vue'
import TuckedSection from '@/components/TuckedSection.vue'
import LoadBody from '@/patterns/LoadBody.vue'
import { useLoad } from '@/patterns/useLoad'
import { screensCounted } from './deviceSettings'
import { screenName } from './screenNaming'

const props = defineProps<{
  /** A Device in a Device Group, whose own Screens are parked. */
  device: DeviceDetail
  group: { id: string, name: string }
}>()

const own = useLoad(() => listOwnScreens(props.device.id), { key: () => props.device.id })
const open = ref<string>()

const rows = computed(() => own.data?.map(screen => ({ ...screen, name: screenName(screen.name) })) ?? [])
const note = computed(() => own.data ? screensCounted(own.data.length) : undefined)
</script>

<template>
  <TuckedSection id="own-screens" :title="`${device.name}'s own Screens, parked`" :note="note" class="parked">
    <p class="sentence">
      Kept while {{ device.name }} is in {{ group.name }}, and shown again from the first in their Order when it leaves. Nothing here can be changed until then.
    </p>
    <LoadBody :load="own" :loading="`Loading ${device.name}'s own Screens`" :failed="`Could not load ${device.name}'s own Screens.`">
      <template #default="{ data }">
        <p v-if="data.length === 0" class="none">
          {{ device.name }} has no Screens of its own.
        </p>
        <ScreenRows v-else v-model:open="open" :items="rows">
          <template #default="{ item }">
            <ScreenRow :value="item.id" :name="item.name" :kind="SCREEN_KIND_LABELS[item.kind]" :passed-over="true">
              <template #thumbnail>
                <Plate
                  :name="`${item.name}, as last rendered`"
                  :src="item.imagePath && imageUrl(item.imagePath)"
                  size="row"
                  :width="device.deviceModel?.width"
                  :height="device.deviceModel?.height"
                  passed-over
                  lazy
                />
              </template>
              <p class="parked-why">
                Parked. It comes back when {{ device.name }} leaves {{ group.name }}.
              </p>
            </ScreenRow>
          </template>
        </ScreenRows>
      </template>
    </LoadBody>
  </TuckedSection>
</template>

<style scoped>
@layer components {
  .parked {
    margin-top: var(--space-10);
  }

  .sentence,
  .none,
  .parked-why {
    max-width: 70ch;
    color: var(--color-ink-soft);
  }

  .sentence {
    margin-bottom: var(--space-4);
  }
}
</style>
