<script setup lang="ts">
import { RouterLink } from 'vue-router'
import PageSection from '@/patterns/PageSection.vue'
import { recipeGalleryPath } from './pluginPaths'

defineProps<{
  /** The Recipe's author text. */
  bio: string | null
  /** TRMNL's id for the author, known only to a visitor who came from a Gallery card; without it there is no link. */
  authorId?: string
  /** The Device the Gallery is opened with, so "More by this author" keeps carrying it. */
  deviceId?: string
}>()
</script>

<template>
  <PageSection v-if="bio || authorId" title="Author">
    <p v-if="bio" class="bio">
      {{ bio }}
    </p>
    <p v-if="authorId">
      <RouterLink :to="recipeGalleryPath(deviceId, authorId)">
        More by this author
      </RouterLink>
    </p>
  </PageSection>
</template>

<style scoped>
@layer components {
  .bio {
    overflow-wrap: anywhere;
    white-space: pre-line;
  }
}
</style>
