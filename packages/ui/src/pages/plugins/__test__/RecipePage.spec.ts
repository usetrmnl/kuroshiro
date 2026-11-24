import { HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { expectAccessible } from '@/testing/a11y'
import { apiErrorResponse } from '@/testing/api/server'
import { mountApp } from '@/testing/app'
import { buildRecipeDetail } from '@/testing/fixtures/plugins'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { fakeGallery, MOON_PHASE, mountGallery } from './recipeGalleryHarness'

async function mountRecipe(at = '/plugins/recipes/41120') {
  const screen = await mountApp({ at })
  await expect.element(screen.getByRole('heading', { name: 'Moon Phase', level: 1 })).toBeVisible()
  return screen
}

describe('a Recipe\'s own page', () => {
  it('shows what the Recipe is before anything is imported', async () => {
    fakeGallery()
    const screen = await mountRecipe()

    await expect.element(screen.getByText('Tonight\'s phase of the Moon, with moonrise and moonset')).toBeVisible()
    await expect.element(screen.getByText('I draw the sky for a living and the Moon is my favourite part of it.')).toBeVisible()
    await expect.element(screen.getByText('Where you watch the sky from')).toBeVisible()
    await expect.element(screen.getByText('Required')).toBeVisible()
    await expect.element(screen.getByText('api.farmsense.net')).toBeVisible()
    await expect.element(screen.getByRole('button', { name: 'Import Recipe' })).toBeVisible()
    await expect.element(screen.getByRole('link', { name: 'Recipes', exact: true })).toHaveAttribute('href', '/plugins/recipes')
    await expectAccessible()
    await expectNoHorizontalOverflow()
  })

  it('is drawn without the list\'s facts, and without "More by this author", when reached by its address', async () => {
    fakeGallery()
    const screen = await mountRecipe()

    await expect.element(screen.getByRole('img')).not.toBeInTheDocument()
    await expect.element(screen.getByText('installs')).not.toBeInTheDocument()
    await expect.element(screen.getByRole('link', { name: 'More by this author' })).not.toBeInTheDocument()
  })

  it('opens from a Gallery card, which hands on its screenshot, installs and author', async () => {
    fakeGallery()
    const screen = await mountGallery()

    await screen.getByRole('link', { name: 'Moon Phase', exact: true }).first().click()

    await expect.element(screen.getByRole('heading', { name: 'Moon Phase', level: 1 })).toBeVisible()
    expect(screen.router.currentRoute.value.fullPath).toBe('/plugins/recipes/41120')
    await expect.element(screen.getByRole('img', { name: 'Screenshot of Moon Phase' })).toHaveAttribute('src', MOON_PHASE.screenshotUrl)
    await expect.element(screen.getByText('2,140 installs')).toBeVisible()
    await expect.element(screen.getByRole('link', { name: 'More by this author' })).toHaveAttribute('href', '/plugins/recipes?author=23360')
  })

  it('lists the author\'s other Recipes in the Gallery, held in the address and sent as the author filter', async () => {
    const faked = fakeGallery()
    const screen = await mountGallery()
    await screen.getByRole('link', { name: 'Moon Phase', exact: true }).first().click()

    await screen.getByRole('link', { name: 'More by this author' }).click()

    await expect.element(screen.getByText('Showing the Recipes of one author.')).toBeVisible()
    expect(screen.router.currentRoute.value.fullPath).toBe('/plugins/recipes?author=23360')
    expect(faked.asked.at(-1)).toMatchObject({ author: '23360' })

    await screen.getByRole('button', { name: 'Show every author' }).click()

    expect(screen.router.currentRoute.value.fullPath).toBe('/plugins/recipes')
    expect(faked.asked.at(-1)).not.toHaveProperty('author')
  })

  it('imports with the Recipe\'s id and opens the new Plugin\'s page', async () => {
    const faked = fakeGallery()
    const screen = await mountRecipe()

    await screen.getByRole('button', { name: 'Import Recipe' }).click()

    await expect.poll(() => faked.sent).toEqual([{ recipe: '41120' }])
  })

  it('carries the Device it came from into the import', async () => {
    const faked = fakeGallery()
    const screen = await mountRecipe('/plugins/recipes/41120?device=kitchen')

    await expect.element(screen.getByText('It is assigned to Kitchen as soon as it exists.')).toBeVisible()
    await expect.element(screen.getByRole('link', { name: 'Recipes', exact: true })).toHaveAttribute('href', '/plugins/recipes?device=kitchen')
    await screen.getByRole('button', { name: 'Import Recipe' }).click()

    await expect.poll(() => faked.sent).toEqual([{ recipe: '41120', deviceId: 'kitchen' }])
  })

  it('shows the refusal the import would give, in its own wording, and offers no import', async () => {
    fakeGallery({
      recipe: () => HttpResponse.json(buildRecipeDetail({
        refusal: { code: 'recipe-strategy-unsupported', message: 'x', details: { strategy: 'plugin_merge' } },
      })),
    })
    const screen = await mountRecipe()

    await expect.element(screen.getByText('This Recipe combines other TRMNL plugins, which Kuroshiro cannot import.')).toBeVisible()
    await expect.element(screen.getByRole('button', { name: 'Import Recipe' })).not.toBeInTheDocument()
    await expect.element(screen.getByText('Where you watch the sky from')).toBeVisible()
  })

  it('says when trmnl.com does not answer, with "Try again"', async () => {
    fakeGallery({ recipe: () => apiErrorResponse({ statusCode: 502, code: 'upstream-unreachable', message: 'trmnl.com did not answer: down' }) })
    const screen = await mountApp({ at: '/plugins/recipes/41120' })

    await expect.element(screen.getByText('Could not load the Recipe.')).toBeVisible()
    await expect.element(screen.getByRole('button', { name: 'Try again' })).toBeVisible()
  })
})
