<script setup lang="ts">
import WashBar from '@/patterns/WashBar.vue'
import ScreenRowsSkeleton from './ScreenRowsSkeleton.vue'

const MEMBER_WIDTHS = ['30%', '24%']
</script>

<template>
  <div class="group-loading" aria-hidden="true">
    <p class="heading">
      Devices in the Group
    </p>
    <div v-for="width in MEMBER_WIDTHS" :key="width" class="member">
      <WashBar :width="width" />
    </div>
    <ScreenRowsSkeleton />
  </div>
</template>

<style scoped>
@layer components {
  .group-loading {
    margin-top: var(--space-8);
  }

  .heading {
    padding-bottom: var(--space-2);
    border-bottom: var(--rule-heavy);
    font-stretch: var(--width-title);
    font-weight: var(--weight-title);
    font-size: var(--title-sm);
    line-height: var(--leading-title);
  }

  .member {
    padding: var(--space-4) 0;
    border-bottom: var(--rule);
  }
}
</style>
