<script setup lang="ts">
import type { RecipeDetail } from 'kuroshiro-shared'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getRecipe, importRecipe } from '@/api/plugins'
import Button from '@/components/Button.vue'
import Icon from '@/components/Icon.vue'
import Notice from '@/components/Notice.vue'
import Plate from '@/components/Plate.vue'
import LoadBody from '@/patterns/LoadBody.vue'
import TitleLine from '@/patterns/TitleLine.vue'
import { useLoad } from '@/patterns/useLoad'
import { useCarriedDevice } from './carriedDevice'
import { RECIPE_IMPORT_WORDING, useImportPluginOnto } from './importPlugin'
import { recipeGalleryPath } from './pluginPaths'
import { installsLine } from './recipeGallery'
import { handedRecipe, refusalLine } from './recipePage'
import RecipeSections from './RecipeSections.vue'

const route = useRoute()
const router = useRouter()
const recipeId = computed(() => String(route.params.recipeId))

const { device } = useCarriedDevice()
const load = useLoad(() => getRecipe(recipeId.value), { key: () => recipeId.value })

// The Gallery card hands on its entry; a pasted link or a reload has none, and the page stays complete without it.
const entry = computed(() => handedRecipe(router.options.history.state, recipeId.value))
const name = computed(() => load.data?.name ?? entry.value?.name ?? 'Recipe')

const importing = useImportPluginOnto(device, RECIPE_IMPORT_WORDING)
const trouble = computed(() => {
  const { entered, unanswered, failure } = importing.trouble
  return entered ?? (unanswered && `${unanswered} Nothing was imported.`) ?? failure
})

function add(recipe: RecipeDetail) {
  return importing.run(deviceId => importRecipe({ recipe: recipe.id, deviceId }))
}
</script>

<template>
  <TitleLine :title="name" :back="{ label: 'Recipes', to: recipeGalleryPath(device?.id) }" />
  <LoadBody v-slot="{ data }" :load="load" loading="Loading the Recipe" failed="Could not load the Recipe.">
    <div class="recipe-page">
      <p v-if="data.description" class="lede">
        {{ data.description }}
      </p>
      <Plate v-if="entry?.screenshotUrl" class="shot" :name="`Screenshot of ${data.name}`" :width="800" :height="480">
        <img class="screenshot" :src="entry.screenshotUrl" :alt="`Screenshot of ${data.name}`" decoding="async" referrerpolicy="no-referrer">
      </Plate>
      <p v-if="entry" class="facts">
        <span>{{ installsLine(entry.installs) }}</span>
        <template v-if="entry.recipeUrl">
          ·
          <a :href="entry.recipeUrl" target="_blank" rel="noopener noreferrer">On trmnl.com</a>
        </template>
      </p>

      <p v-if="refusalLine(data)" class="refusal" role="status">
        <Icon name="problem" class="mark" />
        <span>{{ refusalLine(data) }}</span>
      </p>

      <RecipeSections :recipe="data" :author-id="entry?.userId ?? undefined" :device-id="device?.id" />

      <Notice v-if="importing.trouble.unanswered" :title="importing.trouble.unanswered" reason="Nothing was imported." action="Try again" @act="add(data)" />
      <p v-if="trouble && !importing.trouble.unanswered" class="refusal" role="alert">
        <Icon name="problem" class="mark" />
        <span>{{ trouble }}</span>
      </p>
      <div v-if="!data.refusal" class="actions">
        <Button variant="primary" :loading="importing.importing" @click="add(data)">
          Import Recipe
        </Button>
        <p v-if="device" class="said">
          It is assigned to {{ device.name }} as soon as it exists.
        </p>
      </div>
    </div>
  </LoadBody>
</template>

<style scoped>
@layer components {
  .recipe-page {
    display: grid;
    gap: var(--space-6);
    max-width: var(--measure);
  }

  .lede,
  .said,
  .facts {
    color: var(--color-ink-soft);
  }

  .shot {
    max-width: 30rem;
  }

  .screenshot {
    width: 100%;
    height: 100%;
    border-radius: var(--radius-plate);
    object-fit: contain;
  }

  .refusal {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    font-weight: var(--weight-medium);
  }

  .mark {
    flex: none;
    margin-top: calc((1lh - var(--icon)) / 2);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3) var(--space-6);
    align-items: center;
  }
}
</style>
