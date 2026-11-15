import type { ScreenKind, ScreenPluginReference, ScreenRead } from 'kuroshiro-shared'
import type { RenderTarget } from './screenTarget'
import type { Sentence } from './sentence'
import { formatBytes } from '@/components/fileRules'
import { unassignWording } from '@/pages/plugins/pluginDevices'
import { pluginPath } from '@/pages/plugins/pluginPaths'
import { listed } from '@/patterns/listed'
import { clockTime, exactTime, relativeTime } from '@/patterns/time'
import { possessive, screenName } from './screenNaming'
import { linkTo, sentence } from './sentence'

const UPLOAD_DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

const startOfSentence = (words: string) => words.charAt(0).toUpperCase() + words.slice(1)

/** What a Device's images are made for: "TRMNL OG, Greyscale". Empty for a Device with neither a Device Model nor a Palette, and where there is no Device. */
export function rendersFor(device: Pick<RenderTarget, 'deviceModel' | 'palette'> | undefined) {
  return [device?.deviceModel?.label, device?.palette?.name].filter(Boolean).join(', ')
}

/** "1600 × 960 · 412 KB · uploaded 12 September 2026. Converted for TRMNL OG, Greyscale." A Screen uploaded before the facts were kept has only some of them. */
export function fileFacts(file: NonNullable<ScreenRead['file']>, device: Pick<RenderTarget, 'deviceModel' | 'palette'> | undefined) {
  const facts = [
    file.width !== null && file.height !== null ? `${file.width} × ${file.height}` : undefined,
    file.bytes !== null ? formatBytes(file.bytes) : undefined,
    file.uploadedAt ? `uploaded ${UPLOAD_DAY.format(new Date(file.uploadedAt))}` : undefined,
  ].filter(fact => fact !== undefined)
  const convertedFor = rendersFor(device)
  return [
    facts.length > 0 ? `${startOfSentence(facts.join(' · '))}.` : undefined,
    convertedFor ? `Converted for ${convertedFor}.` : undefined,
  ].filter(Boolean).join(' ')
}

function lastRendered(renderedAt: string, now: Date) {
  const at = new Date(renderedAt)
  return relativeTime(at, now) ? `, last at ${clockTime(at)}` : `, last on ${exactTime(at)}`
}

export function pluginRenderedSentence(plugin: ScreenPluginReference, renderedAt: string | null, now: Date): Sentence {
  return sentence(
    'Rendered from the Plugin ',
    linkTo(plugin.name, pluginPath(plugin.id)),
    `${renderedAt ? lastRendered(renderedAt, now) : ''}.`,
  )
}

export interface RemovalWording {
  /** The button's name, which the confirming button repeats. */
  action: string
  title: string
  lost: string
  stays: string
}

const LOST_WITH_THE_SCREEN: Record<Exclude<ScreenKind, 'plugin'>, string> = {
  file: 'the uploaded image',
  mashup: 'the Mashup\'s layout',
  html: 'the HTML written for it',
  external: 'the link',
}

/** A Plugin Assignment is unassigned; every other Screen is deleted. `ownerName` is the Device's or the Device Group's. */
export function removalWording(screen: Pick<ScreenRead, 'kind' | 'name' | 'plugin'>, ownerName: string): RemovalWording {
  const name = screenName(screen.name)
  if (screen.kind === 'plugin' && screen.plugin) {
    return { action: 'Unassign Plugin', ...unassignWording(screen.plugin, ownerName) }
  }
  return {
    action: 'Delete Screen',
    title: `Delete ${name}?`,
    lost: screen.kind === 'plugin' ? 'The Screen and its Schedule.' : `The Screen, its Schedule and ${LOST_WITH_THE_SCREEN[screen.kind]}.`,
    stays: screen.kind === 'mashup' ? 'The Plugins in its slots.' : `${possessive(ownerName)} other Screens, which move up in the Order.`,
  }
}

/** The one line a Screen shown from a Device Group says about what it is made from, where it cannot be edited: the link, the file, the Mashup's Plugins. */
export function readOnlySourceLine(screen: Pick<ScreenRead, 'kind' | 'external' | 'file' | 'mashup'>) {
  if (screen.external)
    return screen.external.url
  if (screen.file)
    return screen.file.originalName ?? undefined
  if (screen.mashup)
    return listed(screen.mashup.slots.map(slot => slot.pluginName))
  return screen.kind === 'html' ? 'Rendered from HTML written on the Group, on every poll.' : undefined
}

export function isWebAddress(address: string) {
  return /^https?:\/\/\S+$/i.test(address.trim())
}

export function noSlotLine(pluginNames: string[]) {
  return pluginNames.length === 1
    ? `${pluginNames[0]} no longer has a slot. The Plugin itself stays.`
    : `${listed(pluginNames)} no longer have a slot. The Plugins themselves stay.`
}
