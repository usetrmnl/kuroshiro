import { http } from 'msw'
import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { expectAccessible } from '@/testing/a11y'
import { api, apiErrorResponse, apiUrl } from '@/testing/api/server'
import { mountApp } from '@/testing/app'
import { buildDeviceGroup } from '@/testing/fixtures/device-groups'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { DEVICES, DOWNSTAIRS, fakeDownstairs, GROUP_ID, GROUP_SCREENS, HALLWAY, KITCHEN, mountGroup, NEW_SCREEN_ID, openedRow, rowChips, words } from './deviceGroupHarness'

const main = (screen: Awaited<ReturnType<typeof mountGroup>>) => screen.getByRole('main')

describe('the Device Group page', () => {
  it('names the Group, lists its Devices with their Device Model and Palette, and its Screens with what each Device shows', async () => {
    fakeDownstairs()
    const screen = await mountGroup()

    const members = main(screen).getByRole('list', { name: 'Devices in the Group' })
    await expect.element(members.getByRole('link', { name: 'Kitchen' })).toHaveAttribute('href', '/devices/kitchen')
    expect(words(members.element())).toContain('TRMNL OG (2-bit) · Greyscale, 4 levels')
    expect(words(members.element())).toContain('TRMNL X · Greyscale, 16 levels')
    await expect.poll(() => rowChips(screen)).toEqual([
      ['Weather', 'Kitchen: Active Screen · Hallway: Up next'],
      ['Harbour photo', 'Kitchen: Up next · Hallway: Active Screen'],
      ['Notes', ''],
    ])
    await expect.element(main(screen).getByRole('link', { name: 'Add Screen' })).toHaveAttribute('href', `/device-groups/${GROUP_ID}/screens/new`)
  })

  it('opens a Screen with each Device\'s rendering and state, and "Show next" for the Device that waits on it', async () => {
    const faked = fakeDownstairs()
    const screen = await mountGroup('?screen=notes')

    const row = await openedRow(screen, 'Notes')
    await expect.element(row.getByRole('img', { name: 'Notes, as rendered for Kitchen' })).toBeVisible()
    const each = row.getByRole('list', { name: 'On each Device' })
    expect(words(each.element())).toContain('Kitchen · Waiting its turn')
    expect(words(each.element())).toContain('Hallway · Waiting its turn')
    expect(words(each.element())).toContain('Not rendered yet')

    await row.getByRole('button', { name: 'Show next' }).first().click()

    await expect.poll(() => faked.writes).toEqual([{ method: 'PUT', path: 'devices/kitchen/picked-screen', body: { screenId: 'notes' } }])
    await expect.poll(() => words(each.element())).toContain('Kitchen · Up next · picked by hand')
    await expect.element(row.getByRole('button', { name: 'Back to Order' })).toBeVisible()
  })

  it('offers no "Show next" for a mirrored member, whose Rotation is paused', async () => {
    fakeDownstairs({ group: buildDeviceGroup({ id: GROUP_ID, name: 'Downstairs', members: [{ ...KITCHEN, isMirrored: true }, HALLWAY] }) })
    const screen = await mountGroup('?screen=notes')

    const row = await openedRow(screen, 'Notes')
    const each = row.getByRole('list', { name: 'On each Device' })
    await expect.element(each.getByRole('listitem').nth(1).getByRole('button', { name: 'Show next' })).toBeVisible()
    expect(each.getByRole('listitem').nth(0).getByRole('button', { name: 'Show next' }).query()).toBeNull()
  })

  it('offers no "Show next" where a Device shows the Screen or turns to it next, and says so when no Device is in the Group', async () => {
    fakeDownstairs({ group: buildDeviceGroup({ id: GROUP_ID, name: 'Downstairs', members: [] }), screens: GROUP_SCREENS.map(screen => ({ ...screen, perDevice: [] })) })
    const screen = await mountGroup('?screen=weather')

    const row = await openedRow(screen, 'Weather')
    await expect.element(row.getByText('No Device shows it yet: Downstairs has no Device.')).toBeVisible()
    expect(row.getByRole('button', { name: 'Show next' }).query()).toBeNull()
    await expect.element(main(screen).getByText('No Device shows these Screens yet. Add a Device to the Group above.')).toBeVisible()
    await expect.element(main(screen).getByRole('heading', { level: 3, name: 'No Device in Downstairs yet' })).toBeVisible()
  })

  it('adds a Device from the ungrouped ones, saying what joining does, and sends the Group as its setting', async () => {
    const faked = fakeDownstairs()
    const screen = await mountGroup()

    await main(screen).getByRole('combobox', { name: 'Add a Device' }).click()
    await expect.element(screen.getByRole('option', { name: 'Study' })).toBeVisible()
    expect(screen.getByRole('option', { name: 'Kitchen' }).query()).toBeNull()
    await screen.getByRole('option', { name: 'Study' }).click()
    await expect.element(main(screen).getByText('Its own Screens are parked while it is in Downstairs and come back when it leaves. It starts Downstairs\'s Order from the first Screen.')).toBeVisible()
    await main(screen).getByRole('button', { name: 'Add to Downstairs' }).click()

    await expect.poll(() => faked.writes).toEqual([{ method: 'PATCH', path: 'devices/study', body: { deviceGroupId: GROUP_ID } }])
    await expect.element(main(screen).getByRole('list', { name: 'Devices in the Group' }).getByRole('link', { name: 'Study' })).toBeVisible()
    await expect.poll(() => rowChips(screen)[0]).toEqual(['Weather', 'Kitchen: Active Screen · Hallway: Up next'])
  })

  it('offers a Device of another Group, saying that it leaves it', async () => {
    fakeDownstairs({ devices: [...DEVICES.slice(0, 2), { ...DEVICES[2]!, deviceGroup: { id: 'upstairs', name: 'Upstairs' } }] })
    const screen = await mountGroup()

    await main(screen).getByRole('combobox', { name: 'Add a Device' }).click()
    await screen.getByRole('option', { name: 'Study · in Upstairs' }).click()

    await expect.element(main(screen).getByText(/^It leaves Upstairs\./)).toBeVisible()
  })

  it('removes a Device after confirming, and its state leaves every Screen', async () => {
    const faked = fakeDownstairs()
    const screen = await mountGroup()

    const members = main(screen).getByRole('list', { name: 'Devices in the Group' })
    await members.getByRole('button', { name: 'Remove' }).first().click()
    const dialog = screen.getByRole('alertdialog', { name: 'Take Kitchen out of Downstairs?' })
    await expect.element(dialog.getByText('Kitchen shows its own Screens again, from the first in its Order. Nothing is deleted.')).toBeVisible()
    await dialog.getByRole('button', { name: 'Remove' }).click()

    await expect.poll(() => faked.writes).toEqual([{ method: 'PATCH', path: 'devices/kitchen', body: { deviceGroupId: null } }])
    await expect.poll(() => rowChips(screen)).toEqual([['Weather', 'Hallway: Up next'], ['Harbour photo', 'Hallway: Active Screen'], ['Notes', '']])
  })

  it('renames the Group, and the title and the Devices follow; a taken name is refused on the field', async () => {
    const faked = fakeDownstairs()
    const screen = await mountGroup()
    const field = main(screen).getByRole('textbox', { name: 'Name' })

    await field.fill(' Ground floor ')
    await userEvent.keyboard('{Enter}')

    await expect.element(screen.getByRole('heading', { level: 1, name: 'Ground floor' })).toBeVisible()
    expect(faked.writes).toEqual([{ method: 'PATCH', path: `device-groups/${GROUP_ID}`, body: { name: 'Ground floor' } }])

    faked.refusingRename = apiErrorResponse({ statusCode: 409, code: 'device-group-name-taken' })
    await field.fill('Upstairs')
    await userEvent.keyboard('{Enter}')

    await expect.element(main(screen).getByText('Not saved. There is already a Device Group with that name.')).toBeVisible()
    await expect.element(field).toHaveValue('Upstairs')
  })

  it('refuses an empty name on the field and sends nothing', async () => {
    const faked = fakeDownstairs()
    const screen = await mountGroup()
    const field = main(screen).getByRole('textbox', { name: 'Name' })

    await field.fill('   ')
    await userEvent.keyboard('{Enter}')

    await expect.element(main(screen).getByText('A Device Group needs a name.')).toBeVisible()
    expect(faked.writes).toEqual([])
  })

  it('reorders the Screens from an opened row and saves the Order', async () => {
    const faked = fakeDownstairs()
    const screen = await mountGroup('?screen=notes')

    const row = await openedRow(screen, 'Notes')
    await row.getByRole('button', { name: 'Move up' }).click()

    await expect.poll(() => faked.writes).toEqual([{ method: 'PUT', path: `device-groups/${GROUP_ID}/screens/order`, body: { screenIds: ['weather', 'notes', 'photo'] } }])
    await expect.poll(() => rowChips(screen).map(([name]) => name)).toEqual(['Weather', 'Notes', 'Harbour photo'])
  })

  it('gives a Screen a Schedule and deletes a Screen, each on the Group\'s own Screen', async () => {
    const faked = fakeDownstairs()
    const screen = await mountGroup('?screen=photo')

    const row = await openedRow(screen, 'Harbour photo')
    await row.getByRole('button', { name: 'Add a Schedule' }).click()
    await expect.element(row.getByRole('switch', { name: 'Schedule' })).toBeVisible()

    await row.getByRole('button', { name: 'Delete Screen' }).click()
    const dialog = screen.getByRole('alertdialog', { name: 'Delete Harbour photo?' })
    await expect.element(dialog.getByText('Downstairs\'s other Screens, which move up in the Order.')).toBeVisible()
    await dialog.getByRole('button', { name: 'Delete Screen' }).click()

    await expect.poll(() => faked.writes.map(write => `${write.method} ${write.path}`)).toEqual(['POST screens/photo/schedule', 'DELETE screens/photo'])
    await expect.poll(() => rowChips(screen).map(([name]) => name)).toEqual(['Weather', 'Notes'])
  })

  it('unassigns a Plugin Screen from the Group', async () => {
    const faked = fakeDownstairs()
    const screen = await mountGroup('?screen=weather')

    const row = await openedRow(screen, 'Weather')
    await row.getByRole('button', { name: 'Unassign Plugin' }).click()
    await screen.getByRole('alertdialog', { name: 'Unassign Weather from Downstairs?' }).getByRole('button', { name: 'Unassign Plugin' }).click()

    await expect.poll(() => faked.writes).toEqual([{ method: 'DELETE', path: `plugins/weather/assignments/device-groups/${GROUP_ID}` }])
  })

  it('adds an HTML Screen to the Group through Add Screen, previewing it as the first Device renders it', async () => {
    const faked = fakeDownstairs()
    const screen = await mountApp({ at: `/device-groups/${GROUP_ID}/screens/new?kind=html` })
    await expect.element(screen.getByRole('heading', { level: 2, name: 'Add Screen' })).toBeVisible()
    await expect.element(screen.getByRole('link', { name: 'Downstairs\'s Screens' })).toHaveAttribute('href', `/device-groups/${GROUP_ID}`)

    await screen.getByRole('textbox', { name: 'Name', exact: true }).fill('Fridge note')
    const editor = screen.getByRole('textbox', { name: 'HTML' })
    await expect.element(editor).toBeVisible()
    await editor.click()
    await userEvent.keyboard('Milk')
    await screen.getByRole('button', { name: 'Add Screen' }).click()

    await expect.poll(() => screen.router.currentRoute.value.fullPath).toBe(`/device-groups/${GROUP_ID}?screen=${NEW_SCREEN_ID}`)
    expect(faked.writes).toEqual([{ method: 'POST', path: 'screens', body: { kind: 'html', owner: { kind: 'deviceGroup', id: GROUP_ID }, name: 'Fridge note', html: 'Milk', dither: true } }])
    await openedRow(screen, 'Fridge note')
  })

  it('deletes the Group after confirming what is lost and what the Devices go back to, and opens the Devices list', async () => {
    const faked = fakeDownstairs()
    const screen = await mountGroup()

    await main(screen).getByRole('button', { name: 'Delete Downstairs' }).click()
    const dialog = screen.getByRole('alertdialog', { name: 'Delete Downstairs?' })
    await expect.element(dialog.getByText('Downstairs and its 3 Screens with their Schedules.')).toBeVisible()
    await expect.element(dialog.getByText('Kitchen, Hallway: each shows its own Screens again, from the first in its Order.')).toBeVisible()
    await dialog.getByRole('button', { name: 'Delete Downstairs' }).click()

    await expect.poll(() => faked.writes).toEqual([{ method: 'DELETE', path: `device-groups/${GROUP_ID}` }])
    await expect.poll(() => screen.router.currentRoute.value.path).toBe('/devices')
  })

  it('shows the empty Screens block with "Add Screen" for a Group without Screens, and no action on the title line', async () => {
    fakeDownstairs({ screens: [] })
    const screen = await mountGroup()

    await expect.element(main(screen).getByRole('heading', { level: 2, name: 'Add Downstairs\'s first Screen' })).toBeVisible()
    await expect.element(main(screen).getByRole('link', { name: 'Add Screen' })).toHaveAttribute('href', `/device-groups/${GROUP_ID}/screens/new`)
    expect(screen.getByRole('banner').getByRole('link', { name: 'Add Screen' }).query()).toBeNull()
  })

  it('shows "No Device Group here" for a Group that does not exist', async () => {
    fakeDownstairs()
    api.use(http.get(apiUrl('device-groups/gone'), () => apiErrorResponse({ statusCode: 404, code: 'device-group-not-found' })))
    const screen = await mountApp({ at: '/device-groups/gone' })

    await expect.element(screen.getByRole('heading', { level: 1, name: 'No Device Group here' })).toBeVisible()
    await expect.element(screen.getByRole('link', { name: 'All Devices' })).toHaveAttribute('href', '/devices')
  })

  it('shows the notice when the Group cannot be loaded', async () => {
    fakeDownstairs()
    api.use(http.get(apiUrl(`device-groups/${GROUP_ID}`), () => apiErrorResponse({ statusCode: 500, code: 'internal' })))
    const screen = await mountApp({ at: `/device-groups/${GROUP_ID}` })

    await expect.element(screen.getByRole('alert')).toHaveTextContent('Could not load Device Group. Something went wrong on the server.')
  })

  it('is accessible in both themes and does not overflow at phone, tablet or desktop width', async () => {
    fakeDownstairs()
    const screen = await mountGroup('?screen=weather')
    await openedRow(screen, 'Weather')
    await expect.poll(() => [...document.images].every(image => image.complete)).toBe(true)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })

  it('is accessible with no Device and no Screen in the Group', async () => {
    fakeDownstairs({ group: { ...DOWNSTAIRS, members: [] }, screens: [] })
    await mountGroup()

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
