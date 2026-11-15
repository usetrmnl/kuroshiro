<script setup lang="ts">
import type { ScreenTarget } from './screenTarget'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import Button from '@/components/Button.vue'
import EmptyState from '@/components/EmptyState.vue'
import { addPluginPath } from '@/pages/plugins/pluginPaths'

const props = defineProps<{
  target: ScreenTarget
}>()

/** Add a Plugin carries a Device to assign the new Plugin to; a Group is not carried. */
const carried = computed(() => props.target.owner.kind === 'device' ? props.target.owner.id : undefined)
</script>

<template>
  <EmptyState class="no-plugin" title="No Plugins yet" heading="h3">
    A Plugin fetches data and renders it with a template. Import one as a Recipe from TRMNL, or build your own.<template v-if="carried">
      Either way it is assigned to {{ target.name }} when you save it.
    </template>
    <template #action>
      <span class="ways">
        <Button as-child variant="primary">
          <RouterLink :to="addPluginPath('recipe', carried)">
            Import a Recipe
          </RouterLink>
        </Button>
        <Button as-child>
          <RouterLink :to="addPluginPath('poll', carried)">
            Build a Plugin
          </RouterLink>
        </Button>
      </span>
    </template>
  </EmptyState>
</template>

<style scoped>
@layer components {
  /* The page's own heavy rule stands right above it. */
  .empty-state.no-plugin {
    padding-top: 0;
    border-top: 0;
  }

  .ways {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
}
</style>
