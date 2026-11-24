import { SetMetadata } from '@nestjs/common'

/** The metadata key `OpenToSignIn` sets, which the password guard reads. */
export const OPEN_TO_SIGN_IN = 'kuroshiro:open-to-sign-in'

/** Marks the routes a browser calls before it has signed in: the sign-in and sign-out. Still inside the admin API's error envelope and its cross-site check. */
export const OpenToSignIn = () => SetMetadata(OPEN_TO_SIGN_IN, true)
