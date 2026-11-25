<script setup lang="ts">
import { ref } from 'vue'
import { signIn } from '@/api/auth'
import Button from '@/components/Button.vue'
import { failureReason } from '@/components/failureReason'
import Field from '@/components/Field.vue'
import TextInput from '@/components/TextInput.vue'

const emit = defineEmits<{
  signedIn: []
}>()

const password = ref('')
const error = ref<string>()
const signingIn = ref(false)

async function submit() {
  if (signingIn.value || password.value === '')
    return
  signingIn.value = true
  error.value = undefined
  try {
    await signIn(password.value)
    emit('signedIn')
  }
  catch (failure) {
    error.value = failureReason(failure)
    password.value = ''
  }
  finally {
    signingIn.value = false
  }
}
</script>

<template>
  <main class="sign-in">
    <h1>Kuroshiro</h1>
    <form @submit.prevent="submit">
      <Field label="Admin password" :error="error">
        <template #default="{ control }">
          <TextInput v-model="password" v-bind="control" type="password" autocomplete="current-password" wide />
        </template>
      </Field>
      <Button type="submit" variant="primary" :loading="signingIn">
        Sign in
      </Button>
    </form>
  </main>
</template>

<style scoped>
@layer components {
  .sign-in {
    display: grid;
    gap: var(--space-6);
    max-width: 24rem;
    margin: var(--space-16) auto;
    padding-inline: var(--gutter);
  }

  form {
    display: grid;
    gap: var(--space-4);
    justify-items: start;
  }
}
</style>
