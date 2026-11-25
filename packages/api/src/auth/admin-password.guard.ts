import type { CanActivate, ExecutionContext, INestApplication } from '@nestjs/common'
import type { Request } from 'express'
import type { AdminAuth } from './admin-auth.js'
import { HttpStatus } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ApiException } from '../errors/api.exception.js'
import { OUTSIDE_ADMIN_API } from '../errors/outside-admin-api.decorator.js'
import { SESSION_COOKIE } from './admin-auth.js'
import { OPEN_TO_SIGN_IN } from './open-to-sign-in.decorator.js'

export function cookieOf(request: Pick<Request, 'headers'>, name: string): string | undefined {
  const pair = (request.headers.cookie ?? '').split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`))
  return pair?.slice(name.length + 1)
}

function bearerOf(request: Pick<Request, 'headers'>): string | undefined {
  const match = /^Bearer (.*)$/i.exec(request.headers.authorization ?? '')
  return match?.[1]
}

export function tooManyAttempts(): ApiException {
  return new ApiException(HttpStatus.TOO_MANY_REQUESTS, 'too-many-sign-in-attempts', 'Too many wrong passwords from this address. Try again in a minute.')
}

/**
 * Answers 401 to every route of the admin API without the sign-in cookie or the
 * `Authorization: Bearer <password>` header, when the Instance has a password (ADR-0079).
 * The routes marked `OutsideAdminApi`, which the same marker exempts from the cross-site check, and
 * the sign-in and sign-out routes, marked `OpenToSignIn`, are not asked.
 */
export class AdminPasswordGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly auth: AdminAuth) {}

  canActivate(context: ExecutionContext): boolean {
    if (!this.auth.enabled)
      return true
    const targets = [context.getHandler(), context.getClass()]
    if (this.reflector.getAllAndOverride<boolean>(OUTSIDE_ADMIN_API, targets) || this.reflector.getAllAndOverride<boolean>(OPEN_TO_SIGN_IN, targets))
      return true
    const request = context.switchToHttp().getRequest<Request>()
    if (this.auth.isSession(cookieOf(request, SESSION_COOKIE)))
      return true
    const bearer = bearerOf(request)
    if (bearer !== undefined) {
      const address = request.ip ?? ''
      if (this.auth.isThrottled(address))
        throw tooManyAttempts()
      if (this.auth.isPassword(bearer))
        return true
      this.auth.recordWrong(address)
    }
    throw new ApiException(HttpStatus.UNAUTHORIZED, 'sign-in-required', 'Sign in with the admin password.')
  }
}

export function registerAdminPassword(app: INestApplication, auth: AdminAuth): void {
  app.useGlobalGuards(new AdminPasswordGuard(app.get(Reflector), auth))
}
