import type { DeviceGroup, DeviceSummary, GroupScreen, ScreenRead } from 'kuroshiro-shared'
import type { Browser } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { connectDevice } from './devicePlayer.ts'
import { screenStates } from './screensOfDevice.ts'

const baseUrl = inject('baseUrl')

async function listed(friendlyId: string) {
  const devices = await (await fetch(new URL('api/devices', baseUrl))).json() as DeviceSummary[]
  return devices.find(summary => summary.friendlyId === friendlyId)!
}

async function shownBy(deviceId: string) {
  return await (await fetch(new URL(`api/devices/${deviceId}/screens`, baseUrl))).json() as ScreenRead[]
}

describe('sharing Screens in a Device Group', () => {
  let browser: Browser

  beforeAll(async () => {
    browser = await chromium.launch()
  })

  afterAll(async () => {
    await browser.close()
  })

  it('makes a Group from the Devices list, adds two Devices and an HTML Screen, and each Device walks the Order at its own pace', async () => {
    const lobby = await connectDevice(baseUrl, { mac: 'A4:C1:38:5F:0D:01' })
    const foyer = await connectDevice(baseUrl, { mac: 'A4:C1:38:5F:0D:02' })
    const lobbyListed = await listed(lobby.setup.friendly_id)
    const foyerListed = await listed(foyer.setup.friendly_id)
    const groupName = `Ground floor ${Date.now()}`

    const page = await browser.newPage()
    await page.goto(new URL('devices', baseUrl).href)
    await page.getByRole('button', { name: 'New Group' }).click()
    await page.getByRole('textbox', { name: 'Name' }).fill(groupName)
    await page.getByRole('button', { name: 'Create Group' }).click()
    await page.getByRole('heading', { level: 1, name: groupName }).waitFor()

    for (const device of [lobbyListed, foyerListed]) {
      await page.getByRole('combobox', { name: 'Add a Device' }).click()
      await page.getByRole('option', { name: device.name, exact: true }).click()
      await page.getByRole('button', { name: `Add to ${groupName}` }).click()
      await page.getByRole('list', { name: 'Devices in the Group' }).getByRole('link', { name: device.name }).waitFor()
    }

    await page.getByRole('link', { name: 'Add Screen' }).click()
    await page.getByRole('radio', { name: 'HTML' }).click()
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Welcome')
    const editor = page.getByRole('textbox', { name: 'HTML' })
    await editor.click()
    await page.keyboard.insertText('<h1>Welcome</h1>')
    await page.getByRole('button', { name: 'Add Screen' }).click()
    await page.getByRole('region', { name: 'Welcome', exact: true }).waitFor()

    await page.getByRole('link', { name: 'Add Screen' }).click()
    await page.getByRole('radio', { name: 'HTML' }).click()
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Directions')
    await page.getByRole('textbox', { name: 'HTML' }).click()
    await page.keyboard.insertText('<h1>Directions</h1>')
    await page.getByRole('button', { name: 'Add Screen' }).click()
    await page.getByRole('region', { name: 'Directions', exact: true }).waitFor()

    const groupId = new URL(page.url()).pathname.split('/')[2]!
    const group = await (await fetch(new URL(`api/device-groups/${groupId}`, baseUrl))).json() as DeviceGroup
    expect(group.members.map(member => member.name).sort()).toEqual([foyerListed.name, lobbyListed.name].sort())

    await lobby.display()
    await lobby.display()
    await foyer.display()

    const screens = await (await fetch(new URL(`api/device-groups/${groupId}/screens`, baseUrl))).json() as GroupScreen[]
    const stateOf = (name: string, deviceId: string) => screens.find(screen => screen.name === name)!.perDevice.find(state => state.deviceId === deviceId)!.state
    expect(stateOf('Directions', lobbyListed.id)).toBe('active')
    expect(stateOf('Welcome', foyerListed.id)).toBe('active')
    expect((await shownBy(lobbyListed.id)).map(screen => [screen.name, screen.readOnly])).toEqual([['Welcome', true], ['Directions', true]])

    await page.goto(new URL(`devices/${lobbyListed.id}`, baseUrl).href)
    await page.getByRole('link', { name: groupName }).waitFor()
    await expect.poll(() => screenStates(page)).toEqual({ Welcome: 'Up next', Directions: 'Active Screen' })

    await page.goto(new URL(`device-groups/${groupId}`, baseUrl).href)
    await page.getByRole('list', { name: 'Devices in the Group' }).getByRole('button', { name: 'Remove' }).first().click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Remove' }).click()
    await expect.poll(async () => (await (await fetch(new URL(`api/device-groups/${groupId}`, baseUrl))).json() as DeviceGroup).members.length).toBe(1)

    await page.getByRole('button', { name: `Delete ${groupName}` }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: `Delete ${groupName}` }).click()
    await page.getByRole('heading', { level: 1, name: 'Devices' }).waitFor()
    expect((await fetch(new URL(`api/device-groups/${groupId}`, baseUrl))).status).toBe(404)
    expect((await listed(lobby.setup.friendly_id)).deviceGroup).toBeNull()
    await page.close()
  })
})
