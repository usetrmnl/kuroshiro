import type { HttpTestApp } from '../../test/httpApp.js'
import { Controller, Get } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { OutsideAdminApi } from '../../errors/outside-admin-api.decorator.js'
import { InstanceTimeZone } from '../../instance/instance-time-zone.js'
import { InstanceController } from '../../instance/instance.controller.js'
import { createHttpTestApp } from '../../test/httpApp.js'
import { AuthController } from '../auth.controller.js'

const PASSWORD = 'correct horse'

@Controller('health')
@OutsideAdminApi()
class OpenController {
  @Get()
  get() {
    return { ok: true }
  }
}

function metadata() {
  return {
    controllers: [AuthController, InstanceController, OpenController],
    providers: [
      { provide: ConfigService, useValue: { get: () => PASSWORD, getOrThrow: () => 'x' } },
      { provide: InstanceTimeZone, useValue: { name: 'UTC' } },
    ],
  }
}

describe('the admin password', () => {
  let http: HttpTestApp

  beforeAll(async () => {
    http = await createHttpTestApp(metadata() as never, PASSWORD)
  })
  afterAll(async () => {
    await http.app.close()
  })

  const login = (password: string) => http.postJson('/api/auth/login', { password })

  it('refuses an admin route without credentials', async () => {
    const response = await http.request('/api/instance')
    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ code: 'sign-in-required' })
  })

  it('leaves a route marked OutsideAdminApi open', async () => {
    const response = await http.request('/health')
    expect(response.status).toBe(200)
  })

  it('accepts the Bearer password and refuses a wrong one', async () => {
    expect((await http.request('/api/instance', { headers: { authorization: `Bearer ${PASSWORD}` } })).status).not.toBe(401)
    expect((await http.request('/api/instance', { headers: { authorization: 'Bearer nope' } })).status).toBe(401)
  })

  it('signs in with a cookie that opens the API, and signs out', async () => {
    const response = await login(PASSWORD)
    expect(response.status).toBe(204)
    const setCookie = response.headers.get('set-cookie')!
    expect(setCookie).toMatch(/HttpOnly/i)
    expect(setCookie).toMatch(/SameSite=Strict/i)
    expect(setCookie).not.toMatch(/Secure/i)
    const cookie = setCookie.split(';')[0]!
    expect((await http.request('/api/instance', { headers: { cookie } })).status).not.toBe(401)
    expect((await http.request('/api/instance', { headers: { cookie: `${cookie}x` } })).status).toBe(401)
    const out = await http.postJson('/api/auth/logout', {})
    expect(out.status).toBe(204)
    expect(out.headers.get('set-cookie')).toMatch(/Expires=Thu, 01 Jan 1970/)
  })

  it('marks the cookie Secure when the request came over HTTPS', async () => {
    const response = await http.postJson('/api/auth/login', { password: PASSWORD }, { headers: { 'x-forwarded-proto': 'https' } })
    expect(response.headers.get('set-cookie')).toMatch(/Secure/)
  })

  it('answers a wrong password with its own code, then 429 after five', async () => {
    const wrong = await login('nope')
    expect(wrong.status).toBe(401)
    expect(await wrong.json()).toMatchObject({ code: 'wrong-password' })
    await Promise.all([1, 2, 3, 4].map(() => login('nope')))
    const limited = await login(PASSWORD)
    expect(limited.status).toBe(429)
    expect(await limited.json()).toMatchObject({ code: 'too-many-sign-in-attempts' })
    expect((await http.request('/api/instance', { headers: { authorization: `Bearer ${PASSWORD}` } })).status).toBe(429)
  })
})

describe('an Instance without a password', () => {
  it('stays open', async () => {
    const http = await createHttpTestApp(metadata() as never)
    expect((await http.request('/api/instance')).status).not.toBe(401)
    await http.app.close()
  })
})
