import { describe, expect, it } from 'vitest'
import { mountApp } from '@/testing/app'
import { expectPageScreenshots } from '@/testing/screenshots'
import { DOWNSTAIRS, fakeDownstairs, GROUP_ID, openedRow } from './__test__/deviceGroupHarness'

describe('the Device Group page', () => {
  it('with two Devices, three Screens and the File Screen opened, each Device\'s rendering beside it', async () => {
    fakeDownstairs()
    const screen = await mountApp({ at: `/device-groups/${GROUP_ID}?screen=photo` })
    await expect.element(screen.getByRole('heading', { level: 1, name: 'Downstairs' })).toBeVisible()
    await openedRow(screen, 'Harbour photo')
    await expect.element(screen.getByRole('img', { name: 'Harbour photo, as rendered for Hallway' })).toBeVisible()
    await expect.poll(() => [...document.images].every(image => image.complete)).toBe(true)

    await expectPageScreenshots('device-group')
  })

  it('with no Device and no Screen yet', async () => {
    fakeDownstairs({ group: { ...DOWNSTAIRS, members: [] }, screens: [] })
    const screen = await mountApp({ at: `/device-groups/${GROUP_ID}` })
    await expect.element(screen.getByRole('heading', { level: 1, name: 'Downstairs' })).toBeVisible()
    await expect.element(screen.getByRole('heading', { level: 2, name: 'Add Downstairs\'s first Screen' })).toBeVisible()

    await expectPageScreenshots('device-group-empty')
  })
})
