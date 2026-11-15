<script setup lang="ts">
import type { ScreenBody } from 'kuroshiro-shared'
import { RouterLink } from 'vue-router'
import Button from '@/components/Button.vue'
import { editHtmlPathOf, useScreenTarget } from './screenTarget'

defineProps<{
  screen: ScreenBody
}>()

const { path } = useScreenTarget()
</script>

<template>
  <p>Rendered from HTML written here, on every poll.</p>
  <div>
    <Button as-child>
      <RouterLink :to="editHtmlPathOf(path, screen.id)">
        Edit HTML
      </RouterLink>
    </Button>
  </div>
</template>
