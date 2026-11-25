<script setup lang="ts">
import type { RecipeDetail } from 'kuroshiro-shared'
import PageSection from '@/patterns/PageSection.vue'
import RecipeAuthor from './RecipeAuthor.vue'
import { fieldNeed } from './recipePage'

defineProps<{
  recipe: RecipeDetail
  /** TRMNL's id for the author, known only to a visitor who came from a Gallery card. */
  authorId?: string
  /** The Device the Gallery is opened with, so "More by this author" keeps carrying it. */
  deviceId?: string
}>()
</script>

<template>
  <RecipeAuthor :bio="recipe.authorBio" :author-id="authorId" :device-id="deviceId" />

  <PageSection title="Plugin Fields">
    <ul v-if="recipe.fields.length" class="fields">
      <li v-for="field in recipe.fields" :key="field.keyname">
        <strong>{{ field.name }}</strong>
        <span class="need">{{ fieldNeed(field.required) }}</span>
        <span v-if="field.description" class="said">{{ field.description }}</span>
      </li>
    </ul>
    <p v-else class="said">
      It asks for nothing when imported.
    </p>
  </PageSection>

  <PageSection title="Hosts it calls">
    <ul v-if="recipe.hosts.length" class="hosts">
      <li v-for="host in recipe.hosts" :key="host">
        <code>{{ host }}</code>
      </li>
    </ul>
    <p v-else class="said">
      It calls no host.
    </p>
  </PageSection>
</template>

<style scoped>
@layer components {
  .said {
    color: var(--color-ink-soft);
  }

  .fields,
  .hosts {
    display: grid;
    gap: var(--space-3);
  }

  .fields li {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1) var(--space-3);
  }

  .need {
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }
}
</style>
