import { computed, onMounted, reactive, ref, toRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { movedBy } from '@/components/screenRows'
import { useSaveAsChanged } from '@/components/useSaveAsChanged'

/** From this many Screens on the heading counts them, and an opened row can jump to the top and to the end of the Order. */
const MANY_SCREENS = 9

export const screenRowId = (screenId: string) => `screen-${screenId}`

interface Ordered {
  id: string
  renderedAt: string | null
}

/**
 * What a list of Screens in Order does whatever owns them: holds the Order the admin put the rows in until the
 * server's answer has it, saves it, opens one row by `?screen=`, remembers which name is being edited, and which
 * Screens changed since their image was rendered. `saveOrder` sends the Order and reads the Screens again.
 */
export function useScreensInOrder<T extends Ordered>(screens: () => T[], saveOrder: (ids: string[]) => Promise<void>) {
  const route = useRoute()
  const router = useRouter()

  /** The Order the admin put the rows in, until the server's answer holds it. */
  const entered = ref<string[]>()

  const ordered = computed(() => {
    const ids = entered.value
    if (!ids)
      return screens()
    const byId = new Map(screens().map(screen => [screen.id, screen]))
    return [...ids.flatMap(id => byId.get(id) ?? []), ...screens().filter(screen => !ids.includes(screen.id))]
  })

  const isMany = computed(() => screens().length >= MANY_SCREENS)

  const orderSave = useSaveAsChanged(async (ids) => {
    if (!ids)
      return
    await saveOrder(ids)
    if (entered.value === ids)
      entered.value = undefined
  }, entered)

  // A save that failed puts the rows back where the server has them.
  watch(() => orderSave.status, (status) => {
    if (status === 'failed')
      entered.value = undefined
  })

  function reorder(ids: string[]) {
    entered.value = ids
    orderSave.commit()
  }

  function move(id: string, by: number) {
    reorder(movedBy(ordered.value.map(screen => screen.id), id, by))
  }

  const open = computed({
    get: () => typeof route.query.screen === 'string' ? route.query.screen : undefined,
    set: id => void router.replace({ query: { ...route.query, screen: id || undefined } }),
  })

  /** The Screen whose name is being edited in its row. */
  const renaming = ref<string>()

  watch(open, () => {
    renaming.value = undefined
  })

  function setRenaming(screenId: string, isRenaming: boolean) {
    renaming.value = isRenaming ? screenId : undefined
  }

  /** The Screens changed since their image was rendered, each with when that image was rendered. */
  const outdatedImages = ref<Record<string, string | null>>({})

  function awaitRendering(screen: Ordered) {
    outdatedImages.value = { ...outdatedImages.value, [screen.id]: screen.renderedAt }
  }

  const isOutdated = (screen: Ordered) => screen.id in outdatedImages.value && outdatedImages.value[screen.id] === screen.renderedAt

  onMounted(() => {
    if (open.value)
      document.getElementById(screenRowId(open.value))?.scrollIntoView()
  })

  return reactive({
    ordered,
    isMany,
    orderSave,
    reorder,
    move,
    open,
    renaming: toRef(renaming),
    setRenaming,
    awaitRendering,
    isOutdated,
  })
}
