<script setup lang="ts">
import { ref } from 'vue'
import { signInRequired } from '@/api/client'
import { useAlerts, useDevices, useInstanceFacts } from '@/reads/sharedReads'
import AppShell from './shell/AppShell.vue'
import SignInPage from './shell/SignInPage.vue'

signInRequired.value = false
const facts = useInstanceFacts()
const devices = useDevices()
const alerts = useAlerts()
/** Bumped by a sign-in so every page loads again, as it was refused before. */
const signIns = ref(0)

function signedIn() {
  signInRequired.value = false
  signIns.value++
  facts.reload()
  devices.reload()
  alerts.reload()
}
</script>

<template>
  <SignInPage v-if="signInRequired" @signed-in="signedIn" />
  <AppShell v-else :key="signIns" />
</template>
