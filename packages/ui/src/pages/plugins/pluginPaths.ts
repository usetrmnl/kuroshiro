import { PLUGINS_PATH } from '@/shell/barEntries'

export { PLUGINS_PATH }

export const pluginPath = (pluginId: string) => `${PLUGINS_PATH}/${pluginId}`

export type AddPluginWay = 'recipe' | 'file' | 'github' | 'poll' | 'webhook'

/** Add a Plugin, with one of its ways chosen. With a Device, the new Plugin is assigned to it once it exists. */
export function addPluginPath(way: AddPluginWay, deviceId?: string) {
  return `${PLUGINS_PATH}/new?way=${way}${deviceId ? `&device=${encodeURIComponent(deviceId)}` : ''}`
}

/** The Recipe Gallery, of one author's Recipes with `author`. With a Device, the Plugin imported from it is assigned to it once it exists. */
export function recipeGalleryPath(deviceId?: string, author?: string) {
  const query = new URLSearchParams()
  if (author)
    query.set('author', author)
  if (deviceId)
    query.set('device', deviceId)
  return `${PLUGINS_PATH}/recipes${query.size ? `?${query}` : ''}`
}

/** A Recipe's own page. With a Device, the Plugin imported from it is assigned to it once it exists. */
export function recipePath(recipeId: string, deviceId?: string) {
  return `${PLUGINS_PATH}/recipes/${encodeURIComponent(recipeId)}${deviceId ? `?device=${encodeURIComponent(deviceId)}` : ''}`
}

export const recipeUpdatePath = (pluginId: string) => `${pluginPath(pluginId)}/update`
