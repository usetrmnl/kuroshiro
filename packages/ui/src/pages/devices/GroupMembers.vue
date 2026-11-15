<script setup lang="ts">
import type { DeviceGroup } from 'kuroshiro-shared'
import EmptyState from '@/components/EmptyState.vue'
import PageSection from '@/patterns/PageSection.vue'
import AddGroupMember from './AddGroupMember.vue'
import GroupMemberRow from './GroupMemberRow.vue'

defineProps<{
  group: DeviceGroup
  /** Reads the Group and its Screens again, after a Device joined or left. */
  reload: () => Promise<void>
}>()
</script>

<template>
  <PageSection id="devices" title="Devices in the Group">
    <ul v-if="group.members.length > 0" class="members" aria-label="Devices in the Group">
      <GroupMemberRow v-for="member in group.members" :key="member.id" :member="member" :group="group" :reload="reload" />
    </ul>
    <EmptyState v-else class="none" :title="`No Device in ${group.name} yet`" heading="h3">
      A Device that joins shows the Group's Screens instead of its own. Its own Screens are kept and come back when it leaves.
    </EmptyState>
    <AddGroupMember :group="group" :reload="reload" />
  </PageSection>
</template>

<style scoped>
@layer components {
  .members {
    border-top: var(--rule);
  }

  .none {
    margin-top: var(--space-4);
  }
}
</style>
