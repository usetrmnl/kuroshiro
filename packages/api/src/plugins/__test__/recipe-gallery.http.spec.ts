import type { HttpTestApp } from '../../test/httpApp.js'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHttpTestApp } from '../../test/httpApp.js'
import { RecipeGalleryController } from '../recipe-gallery.controller.js'
import { PluginImporterService } from '../services/plugin-importer.service.js'
import { RecipeGalleryService } from '../services/recipe-gallery.service.js'

describe('the Recipe Gallery\'s endpoints', () => {
  let http: HttpTestApp
  const gallery = { page: vi.fn(), categories: vi.fn() }
  const importer = { previewRecipe: vi.fn() }

  beforeAll(async () => {
    http = await createHttpTestApp({
      controllers: [RecipeGalleryController],
      providers: [{ provide: RecipeGalleryService, useValue: gallery }, { provide: PluginImporterService, useValue: importer }],
    })
  })

  beforeEach(() => {
    gallery.page.mockReset().mockResolvedValue({ recipes: [], total: 0, page: 1, perPage: 25, hasMore: false })
    importer.previewRecipe.mockReset().mockResolvedValue({ recipeId: '41120', plugin: { name: 'Lines', fields: [], dataSources: [] }, refusal: null })
    gallery.categories.mockReset().mockResolvedValue(['calendar'])
  })

  afterAll(async () => {
    await http.app.close()
  })

  it('reads GET /api/recipes with the query as the service takes it, the page a number', async () => {
    const response = await http.request('/api/recipes?search=weather&category=calendar&sort=newest&page=2')

    expect(response.status).toBe(200)
    expect(gallery.page).toHaveBeenCalledWith(expect.objectContaining({ search: 'weather', category: 'calendar', sort: 'newest', page: 2 }))
  })

  it('takes a search too short for TRMNL rather than refusing it', async () => {
    expect((await http.request('/api/recipes?search=we')).status).toBe(200)
  })

  it.each([
    ['an order TRMNL\'s fork', 'sort=fork'],
    ['a category that is not a slug', `category=${encodeURIComponent('calendar #news')}`],
    ['a page under 1', 'page=0'],
  ])('refuses %s with 400 validation', async (_what, query) => {
    const response = await http.request(`/api/recipes?${query}`)

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'validation' })
    expect(gallery.page).not.toHaveBeenCalled()
  })

  it('reads GET /api/recipes/categories as a plain list of slugs', async () => {
    const response = await http.request('/api/recipes/categories')

    expect(await response.json()).toEqual(['calendar'])
  })

  it('filters on an author, a number only', async () => {
    expect((await http.request('/api/recipes?author=4821')).status).toBe(200)
    expect(gallery.page).toHaveBeenCalledWith(expect.objectContaining({ author: '4821' }))
    expect((await http.request('/api/recipes?author=abc')).status).toBe(400)
  })

  it('reads GET /api/recipes/:id as the Recipe\'s detail, categories staying its own route', async () => {
    const response = await http.request('/api/recipes/41120')

    expect(response.status).toBe(200)
    expect(importer.previewRecipe).toHaveBeenCalledWith('41120')
    expect(await response.json()).toMatchObject({ id: '41120', name: 'Lines', authorBio: null, fields: [], hosts: [], refusal: null })
    expect(gallery.categories).not.toHaveBeenCalled()
  })
})
