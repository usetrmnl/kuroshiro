<script setup lang="ts">
import type { ScreenBody, ScreenOwner } from 'kuroshiro-shared'
import { computed, ref } from 'vue'
import { deleteScreen, unassignPlugin } from '@/api/screens'
import Button from '@/components/Button.vue'
import Confirmation from '@/components/Confirmation.vue'
import { removalWording } from './screenSourceWording'

const props = defineProps<{
  screen: ScreenBody
  /** The Device or the Device Group the Screen is on. */
  owner: ScreenOwner
  ownerName: string
}>()

defineEmits<{
  /** The Screen is gone from its owner. */
  removed: []
}>()

const asking = ref(false)
const wording = computed(() => removalWording(props.screen, props.ownerName))

function remove() {
  return props.screen.kind === 'plugin' && props.screen.plugin
    ? unassignPlugin(props.screen.plugin.id, props.owner)
    : deleteScreen(props.screen.id)
}
</script>

<template>
  <Button @click="asking = true">
    {{ wording.action }}
  </Button>
  <Confirmation v-model:open="asking" :title="wording.title" :confirm-label="wording.action" :action="remove" @confirmed="$emit('removed')">
    <template #lost>
      {{ wording.lost }}
    </template>
    <template #stays>
      {{ wording.stays }}
    </template>
  </Confirmation>
</template>
