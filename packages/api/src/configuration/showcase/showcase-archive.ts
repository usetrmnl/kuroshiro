import type { AssignmentManifestEntry, ConfigurationManifest, DeviceGroupManifestEntry, DeviceManifestEntry, PluginManifestEntry, ScreenManifestEntry } from '../types.js'
import type { ShowcasePlugin } from './showcase-content.js'
import { Buffer } from 'node:buffer'
import AdmZip from 'adm-zip'
import * as yaml from 'js-yaml'
import { CONFIGURATION_REDACTION_SENTINEL } from 'kuroshiro-shared'
import { CONFIG_SCHEMA_VERSION } from '../schema-version.js'
import { CONFIG_ARCHIVE_FILES } from '../types.js'
import { COUNTDOWN_PLUGIN, JOKE_PLUGIN, LOBBY_PICTURE_PNG_BASE64, SHOWCASE_PLUGINS, WEATHER_PLUGIN } from './showcase-content.js'

// One virtual Device, an obviously fake mac no real hardware can share, never polled by anything but the
// showcase itself. Its apikey is the Redaction Sentinel rather than a fixed value, so Configuration Import
// mints it a fresh one on every fresh instance (ADR-0028) instead of the same key living in every checkout.
const SHOWCASE_DEVICE_ID = '0ddf7be1-349a-449d-8426-14f907316b13'
const SHOWCASE_DEVICE_MAC = 'DE:AD:BE:EF:00:01'

const WEATHER_SCREEN_ID = 'a8ac7686-f803-47bb-ac92-e55d2e0f9d93'
const WEATHER_ASSIGNMENT_ID = '5dcf37fe-c714-48f1-94ae-6955ddba4584'
const COUNTDOWN_SCREEN_ID = '01e8099d-932f-493f-bc72-b1f43c64109e'
const COUNTDOWN_ASSIGNMENT_ID = '488898ac-770c-4df9-9cef-3dbd96d15769'
const COUNTDOWN_SCHEDULE_ID = '7e92a9f8-bdb5-4767-bfba-8f0fbf3c8809'
const MASHUP_SCREEN_ID = '44011247-cad1-4815-b2c1-cb5a4d87fb19'
const MASHUP_CONFIG_ID = '646d1838-782c-4f16-bf47-10aa37bdc620'
const MASHUP_SLOT_LEFT_ID = '79b2af8d-2a98-4fbb-b4ca-c8fa5c536f25'
const MASHUP_SLOT_RIGHT_ID = '89ad8c5d-06bc-4e0b-9218-e6f6f780e041'

// A Device Group of two Devices of different Device Models, with one Plugin Screen and one File Screen. Their
// macs are as fake as the Showcase Device's, and their apikeys are the Redaction Sentinel for the same reason.
const LOBBY_GROUP_ID = '5a0c2b1e-7f43-4d58-9b36-1c8e6d2a4f70'
const LOBBY_GROUP_NAME = 'Lobby displays'
const ENTRANCE_DEVICE_ID = '9c1d7e52-3b08-4a6f-8e14-d5f0a7b3c921'
const RECEPTION_DEVICE_ID = 'e47b3a90-6d15-4c28-a9f3-0b8d2e5c7146'
const LOBBY_WEATHER_SCREEN_ID = '2f6a8c13-b974-4e05-83d1-7a9e0c4b5d68'
const LOBBY_WEATHER_ASSIGNMENT_ID = 'b3e90d47-1a62-4f8c-95b7-c26d8e1f0a39'
const LOBBY_PICTURE_SCREEN_ID = '8d14f7a6-c2e9-4b30-a571-e0936b8d2c4f'

function buildManifest(): ConfigurationManifest {
  return {
    kuroshiroVersion: 'showcase',
    schemaVersion: CONFIG_SCHEMA_VERSION,
    exportedAt: new Date(0).toISOString(),
    containsSecrets: false,
  }
}

function buildDeviceGroups(): DeviceGroupManifestEntry[] {
  return [{ id: LOBBY_GROUP_ID, name: LOBBY_GROUP_NAME }]
}

function buildDevice(entry: Pick<DeviceManifestEntry, 'id' | 'name' | 'friendlyId' | 'mac' | 'deviceModelName' | 'paletteId'> & { deviceGroupId?: string }): DeviceManifestEntry {
  return {
    ...entry,
    apikey: CONFIGURATION_REDACTION_SENTINEL,
    refreshRate: 900,
    mirrorEnabled: null,
    mirrorMac: null,
    mirrorApikey: null,
    sleepModeEnabled: false,
    sleepStartTime: null,
    sleepEndTime: null,
    sleepScreenEnabled: false,
    targetFirmwareId: null,
  }
}

function buildDevices(): DeviceManifestEntry[] {
  return [
    buildDevice({ id: SHOWCASE_DEVICE_ID, name: 'Showcase', friendlyId: 'SHOWCASE', mac: SHOWCASE_DEVICE_MAC, deviceModelName: 'og_plus', paletteId: 'bw' }),
    buildDevice({ id: ENTRANCE_DEVICE_ID, name: 'Entrance', friendlyId: 'ENTRANCE', mac: 'DE:AD:BE:EF:00:02', deviceModelName: 'og_plus', paletteId: 'bw', deviceGroupId: LOBBY_GROUP_ID }),
    buildDevice({ id: RECEPTION_DEVICE_ID, name: 'Reception', friendlyId: 'RECEPTION', mac: 'DE:AD:BE:EF:00:03', deviceModelName: 'v2', paletteId: 'gray-16', deviceGroupId: LOBBY_GROUP_ID }),
  ]
}

function buildPluginEntry(plugin: ShowcasePlugin): PluginManifestEntry {
  return {
    id: plugin.id,
    kind: 'Poll',
    mergeStrategy: null,
    streamLimit: null,
    frameworkVersion: null,
    webhookToken: null,
    sourceRecipeId: plugin.sourceRecipeId,
    sourceRecipeSnapshot: null,
    dataSources: plugin.dataSources.map(source => ({ id: source.id, name: source.name })),
    templates: [{ id: plugin.templateId, layout: 'full' }],
    fields: [],
    fieldValues: {},
  }
}

function buildAssignments(): AssignmentManifestEntry[] {
  return [
    { id: WEATHER_ASSIGNMENT_ID, deviceId: SHOWCASE_DEVICE_ID, pluginId: WEATHER_PLUGIN.id, order: 1, isActive: true },
    { id: COUNTDOWN_ASSIGNMENT_ID, deviceId: SHOWCASE_DEVICE_ID, pluginId: COUNTDOWN_PLUGIN.id, order: 2, isActive: true },
    { id: LOBBY_WEATHER_ASSIGNMENT_ID, deviceId: null, deviceGroupId: LOBBY_GROUP_ID, pluginId: WEATHER_PLUGIN.id, order: 1, isActive: true },
  ]
}

/** A plugin-type Screen for the Weather Plugin, one for the Countdown Plugin with a Schedule narrowing it to daytime, and a Mashup pairing Weather with the Dad Joke Plugin — exercising every Screen kind the brief asks the showcase to carry. */
function buildScreens(): ScreenManifestEntry[] {
  return [
    {
      id: WEATHER_SCREEN_ID,
      deviceId: SHOWCASE_DEVICE_ID,
      type: 'plugin',
      order: 1,
      filename: null,
      externalLink: null,
      html: null,
      fetchManual: false,
      pluginId: WEATHER_PLUGIN.id,
      devicePluginId: WEATHER_ASSIGNMENT_ID,
      schedule: null,
      mashupConfiguration: null,
    },
    {
      id: COUNTDOWN_SCREEN_ID,
      deviceId: SHOWCASE_DEVICE_ID,
      type: 'plugin',
      order: 2,
      filename: null,
      externalLink: null,
      html: null,
      fetchManual: false,
      pluginId: COUNTDOWN_PLUGIN.id,
      devicePluginId: COUNTDOWN_ASSIGNMENT_ID,
      schedule: {
        id: COUNTDOWN_SCHEDULE_ID,
        enabled: true,
        weekdays: null,
        startTime: '06:00',
        endTime: '22:00',
        startDate: null,
        endDate: null,
      },
      mashupConfiguration: null,
    },
    {
      id: MASHUP_SCREEN_ID,
      deviceId: SHOWCASE_DEVICE_ID,
      type: 'mashup',
      order: 3,
      filename: null,
      externalLink: null,
      html: null,
      fetchManual: false,
      pluginId: null,
      devicePluginId: null,
      schedule: null,
      mashupConfiguration: {
        id: MASHUP_CONFIG_ID,
        layout: '1Lx1R',
        slots: [
          { id: MASHUP_SLOT_LEFT_ID, position: 'left', size: 'half_vertical', order: 1, pluginId: WEATHER_PLUGIN.id },
          { id: MASHUP_SLOT_RIGHT_ID, position: 'right', size: 'half_vertical', order: 2, pluginId: JOKE_PLUGIN.id },
        ],
      },
    },
    {
      id: LOBBY_WEATHER_SCREEN_ID,
      deviceId: null,
      owner: { kind: 'deviceGroup', id: LOBBY_GROUP_ID },
      type: 'plugin',
      order: 1,
      filename: null,
      externalLink: null,
      html: null,
      fetchManual: false,
      pluginId: WEATHER_PLUGIN.id,
      devicePluginId: LOBBY_WEATHER_ASSIGNMENT_ID,
      schedule: null,
      mashupConfiguration: null,
    },
    {
      id: LOBBY_PICTURE_SCREEN_ID,
      deviceId: null,
      owner: { kind: 'deviceGroup', id: LOBBY_GROUP_ID },
      type: 'file',
      order: 2,
      filename: `${LOBBY_PICTURE_SCREEN_ID}.png`,
      externalLink: null,
      html: null,
      fetchManual: false,
      pluginId: null,
      devicePluginId: null,
      schedule: null,
      mashupConfiguration: null,
      fileOriginalName: 'lobby-picture.png',
    },
  ]
}

/** The `.trmnlp.yml` + `src/settings.yml` + `src/full.liquid` Configuration Import's `extractPluginZip` expects under `plugins/<id>/`, same shape `PluginExporterService.buildEntries` writes for a real export. */
function addPluginFolder(zip: AdmZip, plugin: ShowcasePlugin): void {
  const manifest = { name: plugin.name, description: plugin.description, custom_fields: [] }
  zip.addFile(`plugins/${plugin.id}/.trmnlp.yml`, Buffer.from(yaml.dump(manifest), 'utf8'))

  const settings = {
    strategy: 'polling',
    refresh_interval: plugin.refreshInterval,
    data_sources: plugin.dataSources.map(source => source.mode === 'literal'
      ? { name: source.name, mode: 'literal', literal_value: source.literalValue }
      : { name: source.name, endpoint: source.endpoint, method: source.method, headers: source.headers ?? {} }),
  }
  zip.addFile(`plugins/${plugin.id}/src/settings.yml`, Buffer.from(yaml.dump(settings), 'utf8'))

  zip.addFile(`plugins/${plugin.id}/src/full.liquid`, Buffer.from(plugin.liquidMarkup, 'utf8'))
}

function addJson(zip: AdmZip, filename: string, value: unknown): void {
  zip.addFile(filename, Buffer.from(JSON.stringify(value), 'utf8'))
}

/**
 * Builds the showcase Configuration Archive in memory, in the exact shape `ConfigurationImportService.importFromZip`
 * already reads — the same manifest/plugins/devices/screens/assignments/palettes/firmware/settings files and nested
 * `plugins/<id>/` folders a real Configuration Export produces (ADR-0021, ADR-0042). Authored from scratch here as
 * TypeScript literals rather than a committed `.zip` or folder of its own, so it needs no build-time asset copying
 * and reviews like any other source change.
 */
export function buildShowcaseArchiveZip(): Buffer {
  const zip = new AdmZip()

  addJson(zip, CONFIG_ARCHIVE_FILES.manifest, buildManifest())
  addJson(zip, CONFIG_ARCHIVE_FILES.plugins, SHOWCASE_PLUGINS.map(buildPluginEntry))
  addJson(zip, CONFIG_ARCHIVE_FILES.deviceGroups, buildDeviceGroups())
  addJson(zip, CONFIG_ARCHIVE_FILES.devices, buildDevices())
  addJson(zip, CONFIG_ARCHIVE_FILES.screens, buildScreens())
  addJson(zip, CONFIG_ARCHIVE_FILES.assignments, buildAssignments())
  addJson(zip, CONFIG_ARCHIVE_FILES.palettes, [])
  addJson(zip, CONFIG_ARCHIVE_FILES.firmware, [])
  addJson(zip, CONFIG_ARCHIVE_FILES.settings, {})

  // The File Screen's upload as it arrived: Configuration Import converts it for each member of the Group.
  zip.addFile(`screens/${LOBBY_PICTURE_SCREEN_ID}.original`, Buffer.from(LOBBY_PICTURE_PNG_BASE64, 'base64'))

  for (const plugin of SHOWCASE_PLUGINS)
    addPluginFolder(zip, plugin)

  return zip.toBuffer()
}
