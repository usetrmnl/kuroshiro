import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { api, apiUrl } from '@/testing/api/server'
import { fakeShellReads, mountApp } from '@/testing/app'
import { buildInstanceFacts } from '@/testing/fixtures/instance'

const signedOut = () => http.get(apiUrl('instance'), () => HttpResponse.json({ statusCode: 401, code: 'sign-in-required', message: 'Sign in with the admin password.' }, { status: 401 }))

describe('the admin password', () => {
  it('opens the password page when the API asks for a sign-in, and the app once it is given', async () => {
    api.use(signedOut())
    const screen = await mountApp({ at: '/plugins' })
    await expect.element(screen.getByLabelText('Admin password')).toBeVisible()

    fakeShellReads({ instance: buildInstanceFacts({ adminPasswordSet: true }) })
    api.use(http.post(apiUrl('auth/login'), () => new HttpResponse(null, { status: 204 })))
    await userEvent.type(screen.getByLabelText('Admin password'), 'secret')
    await userEvent.keyboard('{Enter}')

    await expect.element(screen.getByRole('button', { name: 'Sign out' })).toBeVisible()
  })

  it('words a wrong password where it was typed', async () => {
    api.use(signedOut(), http.post(apiUrl('auth/login'), () => HttpResponse.json({ statusCode: 401, code: 'wrong-password', message: 'x' }, { status: 401 })))
    const screen = await mountApp({ at: '/plugins' })
    await userEvent.type(screen.getByLabelText('Admin password'), 'nope')
    await userEvent.keyboard('{Enter}')

    await expect.element(screen.getByText('That is not the admin password.')).toBeVisible()
  })

  it('shows no "Sign out" when the Instance has no password', async () => {
    fakeShellReads()
    const screen = await mountApp({ at: '/plugins' })
    await expect.element(screen.getByRole('banner')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Sign out' }).elements()).toHaveLength(0)
  })
})
