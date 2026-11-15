import type { AlertsList, DeviceDetail, DeviceGroup, DeviceSummary, GroupScreen, PluginDetail, ScreenOwner, ScreenRead, UpdateDeviceInput, UpdateInstanceSettingsInput, UpdatePluginInput } from 'kuroshiro-shared'

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT'

/** A Device by its id, or any owner of Screens. */
type Owner = string | ScreenOwner

const ownerOf = (owner: Owner): ScreenOwner => typeof owner === 'string' ? { kind: 'device', id: owner } : owner

/** The admin API of the Instance, as the UI calls it. */
export function instanceApi(baseUrl: string) {
  async function call<T>(method: Method, path: string, body?: unknown): Promise<T> {
    const isForm = body instanceof FormData
    const response = await fetch(new URL(`api/${path}`, baseUrl), {
      method,
      headers: body === undefined || isForm ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    })
    if (!response.ok)
      throw new Error(`${method} ${path} answered ${response.status}: ${await response.text()}`)
    const text = await response.text()
    return (text ? JSON.parse(text) : undefined) as T
  }

  return {
    call,
    devices: () => call<DeviceSummary[]>('GET', 'devices'),
    updateDevice: (id: string, changes: UpdateDeviceInput) => call<DeviceDetail>('PATCH', `devices/${id}`, changes),
    screensOf: (deviceId: string) => call<ScreenRead[]>('GET', `devices/${deviceId}/screens`),
    addHtmlScreen: (owner: Owner, name: string, html: string) => call<ScreenRead>('POST', 'screens', { kind: 'html', owner: ownerOf(owner), name, html }),
    addExternalScreen: (owner: Owner, name: string, url: string) => call<ScreenRead>('POST', 'screens', { kind: 'external', owner: ownerOf(owner), name, url, fetchManual: true }),
    addFileScreen: (owner: Owner, name: string, png: Uint8Array) => {
      const form = new FormData()
      form.set('kind', 'file')
      form.set('owner[kind]', ownerOf(owner).kind)
      form.set('owner[id]', ownerOf(owner).id)
      form.set('name', name)
      form.set('file', new Blob([new Uint8Array(png)], { type: 'image/png' }), `${name}.png`)
      return call<ScreenRead>('POST', 'screens', form)
    },
    addMashup: (owner: Owner, name: string, layout: string, pluginIds: string[]) => call<ScreenRead>('POST', 'mashup', { owner: ownerOf(owner), name, layout, pluginIds }),
    createDeviceGroup: (name: string) => call<DeviceGroup>('POST', 'device-groups', { name }),
    groupScreens: (groupId: string) => call<GroupScreen[]>('GET', `device-groups/${groupId}/screens`),
    schedule: (screenId: string, schedule: Record<string, unknown>) => call<unknown>('POST', `screens/${screenId}/schedule`, schedule),
    createPlugin: (input: Record<string, unknown>) => call<PluginDetail>('POST', 'plugins', input),
    plugin: (id: string) => call<PluginDetail>('GET', `plugins/${id}`),
    updatePlugin: (id: string, changes: UpdatePluginInput) => call<PluginDetail>('PATCH', `plugins/${id}`, changes),
    assignPlugin: (pluginId: string, owner: Owner) => call<unknown>('POST', `plugins/${pluginId}/assign`, { owner: ownerOf(owner) }),
    updateSettings: (changes: UpdateInstanceSettingsInput) => call<unknown>('PATCH', 'settings', changes),
    alerts: () => call<AlertsList>('GET', 'alerts'),
  }
}

export type InstanceApi = ReturnType<typeof instanceApi>
