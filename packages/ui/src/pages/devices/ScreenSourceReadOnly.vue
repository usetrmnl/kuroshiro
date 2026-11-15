<script setup lang="ts">
import type { ScreenRead } from 'kuroshiro-shared'
import { computed, useId } from 'vue'
import { RouterLink } from 'vue-router'
import Button from '@/components/Button.vue'
import { SCREEN_KIND_LABELS } from '@/components/screenRows'
import { useNow } from '@/patterns/useNow'
import { deviceGroupPath } from './deviceGroupPaths'
import { pluginRenderedSentence, readOnlySourceLine } from './screenSourceWording'
import SentenceLine from './SentenceLine.vue'

const props = defineProps<{
  /** A Screen the Device shows from its Device Group. */
  screen: ScreenRead
  group: { id: string, name: string }
}>()

const now = useNow()
const headingId = useId()

const line = computed(() => readOnlySourceLine(props.screen))
const rendered = computed(() => props.screen.plugin && pluginRenderedSentence(props.screen.plugin, props.screen.renderedAt, now.value))
</script>

<template>
  <div class="screen-source" role="group" :aria-labelledby="headingId">
    <h4 :id="headingId" class="kind">
      {{ SCREEN_KIND_LABELS[screen.kind] }}
    </h4>
    <SentenceLine v-if="rendered" class="line" :sentence="rendered" />
    <p v-else-if="line" class="line">
      {{ line }}
    </p>
    <p class="soft">
      Edited on {{ group.name }}, for every Device in it.
    </p>
    <div>
      <Button as-child>
        <RouterLink :to="{ path: deviceGroupPath(group.id), query: { screen: screen.id } }">
          Open on {{ group.name }}
        </RouterLink>
      </Button>
    </div>
  </div>
</template>

<style scoped>
@layer components {
  .screen-source {
    display: grid;
    gap: var(--space-3);
    min-width: 0;
  }

  .kind {
    margin: 0;
    font-weight: var(--weight-semibold);
    font-size: var(--text-md);
  }

  .line {
    color: var(--color-ink);
    overflow-wrap: anywhere;
  }

  .soft {
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }
}
</style>
