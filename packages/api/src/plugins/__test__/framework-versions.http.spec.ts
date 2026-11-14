import type { HttpTestApp } from '../../test/httpApp.js'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createHttpTestApp } from '../../test/httpApp.js'
import { FrameworkVersionsController } from '../framework-versions.controller.js'
import { FrameworkVersionsService } from '../services/framework-versions.service.js'

describe('the Framework versions endpoint', () => {
  let http: HttpTestApp

  beforeAll(async () => {
    http = await createHttpTestApp({
      controllers: [FrameworkVersionsController],
      providers: [{ provide: FrameworkVersionsService, useValue: { versions: vi.fn().mockResolvedValue(['3.4.6', '3.3.1']) } }],
    })
  })

  afterAll(async () => {
    await http.app.close()
  })

  it('reads GET /api/framework-versions as a plain list', async () => {
    const response = await http.request('/api/framework-versions')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(['3.4.6', '3.3.1'])
  })
})
