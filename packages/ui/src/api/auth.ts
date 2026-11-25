import { apiSend } from './client'

/** Signs in with the admin password. Refuses with `wrong-password`, or `too-many-sign-in-attempts` after five wrong ones in a minute. */
export function signIn(password: string) {
  return apiSend('POST', 'auth/login', { password })
}

/** Clears the sign-in cookie. */
export function signOut() {
  return apiSend('POST', 'auth/logout')
}
