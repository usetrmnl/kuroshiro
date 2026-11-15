<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import Button from '@/components/Button.vue'
import EmptyState from '@/components/EmptyState.vue'
import Notice from '@/components/Notice.vue'
import BackLink from '@/patterns/BackLink.vue'
import LoadingLine from '@/patterns/LoadingLine.vue'
import { useLoad } from '@/patterns/useLoad'
import EditHtmlForm from './EditHtmlForm.vue'
import { possessive } from './screenNaming'
import { useScreenTarget } from './screenTarget'

const route = useRoute()
const frame = useScreenTarget()
const { name, path } = frame

const screens = useLoad(() => frame.listScreens(), { key: () => route.params.deviceId ?? route.params.groupId })

const failure = computed(() => frame.failure.value ?? screens.failure)
const waiting = computed(() => frame.waiting.value || screens.waiting)
const htmlScreen = computed(() => screens.data?.find(screen => screen.id === route.params.screenId && screen.kind === 'html'))
const missing = computed(() => screens.data !== undefined && !htmlScreen.value)

function reload() {
  void frame.reload()
  void screens.reload()
}
</script>

<template>
  <div class="edit-html">
    <BackLink v-if="!missing" :to="path">
      {{ possessive(name) }} Screens
    </BackLink>
    <Notice v-if="failure" :title="`Could not load ${possessive(name)} Screens.`" :reason="failure.reason" action="Try again" @act="reload" />
    <template v-if="frame.target.value && screens.data">
      <EditHtmlForm v-if="htmlScreen" :key="htmlScreen.id" :target="frame.target.value" :screen="htmlScreen" />
      <EmptyState v-else title="No HTML Screen here" heading="h2" page>
        It may have been deleted, or it is a Screen of another kind, whose HTML cannot be edited.
        <template #action>
          <Button as-child>
            <RouterLink :to="path">
              {{ possessive(name) }} Screens
            </RouterLink>
          </Button>
        </template>
      </EmptyState>
    </template>
    <LoadingLine v-else :shown="waiting && !failure">
      Loading {{ possessive(name) }} Screens
    </LoadingLine>
  </div>
</template>

<style scoped>
@layer components {
  .edit-html {
    margin-top: var(--space-8);
  }

  @media (max-width: 820px) {
    .edit-html {
      margin-top: var(--space-6);
    }
  }
}
</style>
