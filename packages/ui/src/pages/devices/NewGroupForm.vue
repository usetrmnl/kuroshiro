<script setup lang="ts">
import { nextTick, onMounted, ref, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'
import { createDeviceGroup } from '@/api/device-groups'
import Button from '@/components/Button.vue'
import { failureReason } from '@/components/failureReason'
import Field from '@/components/Field.vue'
import TextInput from '@/components/TextInput.vue'
import { deviceGroupPath } from './deviceGroupPaths'
import { groupNameProblem } from './deviceGroups'
import InPlaceForm from './InPlaceForm.vue'

defineEmits<{
  /** The form is done with: the Group was created and its page opens, or "Cancel" was pressed. */
  close: []
}>()

const router = useRouter()
const form = useTemplateRef('form')

const name = ref('')
const problem = ref<string>()
const creating = ref(false)

async function create() {
  problem.value = groupNameProblem(name.value)
  if (problem.value)
    return
  creating.value = true
  try {
    const group = await createDeviceGroup({ name: name.value.trim() })
    await nextTick()
    await router.push(deviceGroupPath(group.id))
  }
  catch (error) {
    problem.value = failureReason(error) ?? 'The Group could not be created.'
  }
  finally {
    creating.value = false
  }
}

onMounted(() => form.value?.querySelector('input')?.focus())
</script>

<template>
  <form ref="form" class="new-group" novalidate @submit.prevent="create">
    <InPlaceForm title="New Group">
      <Field v-slot="{ control }" label="Name" :error="problem" hint="Every Device in the Group shows the same Screens.">
        <TextInput v-bind="control" v-model="name" prose wide @update:model-value="problem = undefined" />
      </Field>
      <template #buttons>
        <Button type="submit" variant="primary" :loading="creating">
          Create Group
        </Button>
        <Button variant="quiet" @click="$emit('close')">
          Cancel
        </Button>
      </template>
    </InPlaceForm>
  </form>
</template>

<style scoped>
@layer components {
  .new-group {
    margin-top: var(--space-4);
  }
}
</style>
