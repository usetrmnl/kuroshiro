<script setup lang="ts">
import type { DeviceGroupSummary } from 'kuroshiro-shared'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { deviceGroupPath } from './deviceGroupPaths'
import { groupFacts } from './deviceGroups'

const props = defineProps<{
  group: DeviceGroupSummary
}>()

const facts = computed(() => groupFacts(props.group))
</script>

<template>
  <li class="group-row">
    <div class="said">
      <h3 class="name">
        <RouterLink class="open" :to="deviceGroupPath(group.id)">
          {{ group.name }}
        </RouterLink>
      </h3>
      <p class="facts">
        {{ facts }}
      </p>
    </div>
    <svg class="leads-on" viewBox="0 0 16 16" focusable="false" aria-hidden="true">
      <path d="M5.4 3.2 10.2 8l-4.8 4.8 1.1 1.1L12.4 8 6.5 2.1z" />
    </svg>
  </li>
</template>

<style scoped>
@layer components {
  .group-row {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) var(--icon);
    align-items: center;
    gap: var(--space-5);
    padding: var(--space-3) 0;
    border-bottom: var(--rule);
  }

  .name {
    font-weight: var(--weight-semibold);
    font-size: var(--text-md);
    overflow-wrap: anywhere;
  }

  /* The whole row opens the Group: the name is the link and its hit area is the row. */
  .open {
    text-decoration: none;
  }

  .open::after {
    content: '';
    position: absolute;
    inset: 0;
  }

  .open:hover {
    text-decoration: underline;
    text-decoration-thickness: 2px;
    text-underline-offset: 4px;
  }

  .facts {
    margin-top: var(--space-1);
    color: var(--color-ink-soft);
  }

  .leads-on {
    width: var(--icon);
    height: var(--icon);
    fill: var(--color-ink-soft);
  }

  @media (max-width: 820px) {
    .group-row {
      grid-template-columns: minmax(0, 1fr);
    }

    .leads-on {
      display: none;
    }
  }
}
</style>
