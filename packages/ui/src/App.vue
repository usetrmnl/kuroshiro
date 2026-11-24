<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { isRefusal } from '@/api/client'
import { getInstanceFacts } from '@/api/instance'
import AppShell from './shell/AppShell.vue'
import SignInPage from './shell/SignInPage.vue'

/** Whether the admin API let the browser in: it answers `sign-in-required` to everything until an Instance with a password has been signed in to. */
const state = ref<'asking' | 'signed-out' | 'in'>('asking')

onMounted(async () => {
  // Any other failure is for the page's own loads to show.
  state.value = await getInstanceFacts().then(() => 'in' as const, error => isRefusal(error, 'sign-in-required') ? 'signed-out' as const : 'in' as const)
})
</script>

<template>
  <AppShell v-if="state === 'in'" />
  <SignInPage v-else-if="state === 'signed-out'" @signed-in="state = 'in'" />
</template>
