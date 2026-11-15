import type { GroupScreen, GroupScreenDeviceState, MashupLayout, MashupSlotRead, RenderSignal, ScheduleRead, ScreenBody, ScreenRead, TemplateSize } from 'kuroshiro-shared'
import type { MashupConfiguration } from '../mashup/entities/mashup-configuration.entity.js'
import type { ScreenStateRead } from '../schedule/rotation.js'
import type { Schedule } from '../schedule/schedule.entity.js'
import type { Screen } from './screens.entity.js'
import { MASHUP_LAYOUTS } from 'kuroshiro-shared'
import { mashupDither } from '../mashup/mashup-dither.js'
import { toImagePath, toIsoString, toIsoStringOrNull } from '../utils/readModel.js'
import { screenImageUrlPath } from './screen-image-paths.js'
import { screenNameOf } from './screen-name.js'

/** What a Screen read carries whatever Device it is read for. */
export interface ScreenBodyFacts {
  requiredFieldEmpty: boolean
  fetchAlertFiring: boolean
}

export interface ScreenFacts extends ScreenBodyFacts {
  deviceId: string
  /** Whether the Screen is the Device's Device Group's, which is edited on the Group. */
  readOnly: boolean
  state: ScreenStateRead
  renderSignal: RenderSignal | null
  /** When the Device's record of the Screen was last rendered or converted. */
  generatedAt: Date
  /** Whether the Screen's rendered image is on disk. */
  isRendered: boolean
}

const STORED_SIZE_PREFIX = 'view--'
const CLOCK_TIME_LENGTH = 'HH:MM'.length

function toClockTimeOrNull(time: string | null | undefined): string | null {
  return time ? time.slice(0, CLOCK_TIME_LENGTH) : null
}

function toScheduleRead(schedule: Schedule): ScheduleRead {
  return {
    id: schedule.id,
    enabled: schedule.enabled,
    weekdays: schedule.weekdays ?? null,
    startTime: toClockTimeOrNull(schedule.startTime),
    endTime: toClockTimeOrNull(schedule.endTime),
    startDate: schedule.startDate ?? null,
    endDate: schedule.endDate ?? null,
  }
}

function toMashupLayoutOrNull(stored: string): MashupLayout | null {
  return MASHUP_LAYOUTS.find(layout => layout.id === stored)?.id ?? null
}

function toMashupRead(configuration: MashupConfiguration | undefined): ScreenRead['mashup'] {
  const layout = configuration && toMashupLayoutOrNull(configuration.layout)
  if (!configuration || !layout)
    return null
  const slots: MashupSlotRead[] = [...configuration.slots ?? []]
    .sort((a, b) => a.order - b.order)
    .map(slot => ({
      position: slot.position,
      size: slot.size.replace(STORED_SIZE_PREFIX, '') as TemplateSize,
      pluginId: slot.plugin.id,
      pluginName: slot.plugin.name,
    }))
  return { layout, slots }
}

function toPluginReference(screen: Screen, facts: ScreenBodyFacts): ScreenRead['plugin'] {
  const { plugin } = screen
  return plugin
    ? { id: plugin.id, name: plugin.name, kind: plugin.kind, requiredFieldEmpty: facts.requiredFieldEmpty, fetchAlertFiring: facts.fetchAlertFiring }
    : null
}

function toFileRead(screen: Screen): ScreenRead['file'] {
  return {
    originalName: screen.fileOriginalName ?? null,
    width: screen.fileWidth ?? null,
    height: screen.fileHeight ?? null,
    bytes: screen.fileBytes ?? null,
    uploadedAt: toIsoStringOrNull(screen.fileUploadedAt),
  }
}

function ditherOf(screen: Screen): boolean {
  switch (screen.type) {
    case 'plugin':
      return screen.plugin?.dither ?? true
    case 'mashup':
      return mashupDither({ slots: screen.mashupConfiguration?.slots ?? [] })
    default:
      return screen.dither
  }
}

function toScreenBody(screen: Screen, facts: ScreenBodyFacts): ScreenBody {
  const kind = screen.type
  return {
    id: screen.id,
    kind,
    name: screenNameOf(screen),
    order: screen.order,
    schedule: screen.schedule ? toScheduleRead(screen.schedule) : null,
    plugin: kind === 'plugin' ? toPluginReference(screen, facts) : null,
    mashup: kind === 'mashup' ? toMashupRead(screen.mashupConfiguration) : null,
    external: kind === 'external' ? { url: screen.externalLink ?? '', fetchManual: screen.fetchManual } : null,
    file: kind === 'file' ? toFileRead(screen) : null,
    html: kind === 'html' ? screen.html ?? '' : null,
    dither: ditherOf(screen),
  }
}

export function toScreenRead(screen: Screen, facts: ScreenFacts): ScreenRead {
  return {
    ...toScreenBody(screen, facts),
    deviceId: facts.deviceId,
    readOnly: facts.readOnly,
    state: facts.state.state,
    stateCause: facts.state.stateCause,
    picked: facts.state.picked,
    renderSignal: facts.renderSignal,
    imagePath: facts.isRendered ? toImagePath(screenImageUrlPath(facts.deviceId, screen.id), facts.generatedAt) : null,
    renderedAt: facts.isRendered ? toIsoString(facts.generatedAt) : null,
  }
}

export interface MemberFacts {
  deviceId: string
  state: ScreenStateRead
  isActive: boolean
  renderSignal: RenderSignal | null
  /** `null` when the member has no stored record of the Screen yet. */
  generatedAt: Date | null
  /** Whether the Screen's image rendered for the member is on disk. */
  isRendered: boolean
}

function toGroupScreenDeviceState(screenId: string, facts: MemberFacts): GroupScreenDeviceState {
  const rendered = facts.isRendered && facts.generatedAt
  return {
    deviceId: facts.deviceId,
    isActive: facts.isActive,
    state: facts.state.state,
    stateCause: facts.state.stateCause,
    picked: facts.state.picked,
    renderSignal: facts.renderSignal,
    generatedAt: toIsoStringOrNull(facts.generatedAt),
    imagePath: rendered ? toImagePath(screenImageUrlPath(facts.deviceId, screenId), facts.generatedAt!) : null,
    renderedAt: rendered ? toIsoString(facts.generatedAt!) : null,
  }
}

export function toGroupScreen(screen: Screen, deviceGroupId: string, facts: ScreenBodyFacts, perDevice: MemberFacts[]): GroupScreen {
  return { ...toScreenBody(screen, facts), deviceGroupId, perDevice: perDevice.map(member => toGroupScreenDeviceState(screen.id, member)) }
}
