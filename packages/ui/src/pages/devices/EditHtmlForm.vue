<script setup lang="ts">
import type { HtmlEditable, ScreenTarget } from './screenTarget'
import { computed, nextTick, ref, useId } from 'vue'
import { useRouter } from 'vue-router'
import { updateScreen } from '@/api/screens'
import CodeEditor from '@/components/CodeEditor.vue'
import EditorBench from '@/components/EditorBench.vue'
import { failureReason, notSavedSentence } from '@/components/failureReason'
import FieldError from '@/components/FieldError.vue'
import AddFormFoot from '@/patterns/AddFormFoot.vue'
import DitheringField from '@/patterns/DitheringField.vue'
import HtmlPreview from './HtmlPreview.vue'
import { htmlProblem, possessive, screenName } from './screenNaming'
import { useScreenTarget } from './screenTarget'

const props = defineProps<{
  target: ScreenTarget
  /** An HTML Screen of the target. */
  screen: HtmlEditable
}>()

const router = useRouter()
const { path } = useScreenTarget()

const headingId = useId()
const errorId = useId()

const named = computed(() => screenName(props.screen.name))
const saved = ref(props.screen.html ?? '')
const html = ref(saved.value)
const savedDither = ref(props.screen.dither)
const dither = ref(savedDither.value)
const changed = computed(() => html.value !== saved.value || dither.value !== savedDither.value)

const saving = ref(false)
const failure = ref<string>()
const emptyError = ref<string>()

const openedRow = computed(() => `${path.value}?screen=${props.screen.id}`)

async function save() {
  if (saving.value)
    return
  emptyError.value = htmlProblem(html.value)
  if (emptyError.value)
    return
  failure.value = undefined
  saving.value = true
  try {
    const answered = await updateScreen(props.screen.id, { html: html.value, dither: dither.value })
    saved.value = answered.html ?? html.value
    html.value = saved.value
    savedDither.value = answered.dither
    dither.value = answered.dither
    await nextTick()
    await router.push(openedRow.value)
  }
  catch (error) {
    failure.value = notSavedSentence(failureReason(error))
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <form class="edit-html-form" novalidate :aria-labelledby="headingId" @submit.prevent="save">
    <h2 :id="headingId" class="heading">
      Edit {{ named }}
    </h2>
    <EditorBench class="html-bench">
      <template #editor>
        <CodeEditor
          v-model="html"
          mode="html"
          :aria-label="`HTML of ${named}`"
          :aria-describedby="emptyError ? errorId : undefined"
          :invalid="Boolean(emptyError)"
          @save="save"
        />
        <FieldError :id="errorId" :message="emptyError" />
        <DitheringField v-model="dither" />
      </template>
      <template #plate>
        <HtmlPreview v-if="target.rendersAs" :device="target.rendersAs" :html="html" :name="`Preview of ${named}`" :dither="dither" facts />
        <p v-else class="no-preview">
          No preview: {{ target.name }} has no Device yet to render it for.
        </p>
      </template>
    </EditorBench>
    <AddFormFoot
      button="Save HTML"
      :running="saving"
      :changed="changed"
      :failure="failure"
      :cancel-to="openedRow"
      retryable
      @retry="save"
    >
      {{ target.name }} shows the change when this Screen's turn next comes.
      <template #lost>
        Your changes to {{ possessive(named) }} HTML.
      </template>
    </AddFormFoot>
  </form>
</template>

<style scoped>
@layer components {
  .heading {
    margin-top: var(--space-4);
    padding-bottom: var(--space-2);
    border-bottom: var(--rule-heavy);
    font-stretch: var(--width-title);
    font-weight: var(--weight-title);
    font-size: var(--title-sm);
    line-height: var(--leading-title);
  }

  /* Not `bench`: the editor inside wears that class for its size, and it stands in this component's scope. */
  .html-bench {
    margin-top: var(--space-5);
    margin-bottom: var(--space-6);
  }

  .no-preview {
    color: var(--color-ink-soft);
  }
}
</style>
