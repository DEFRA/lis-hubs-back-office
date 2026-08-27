import Boom from '@hapi/boom'
import { hasPermission, PERMISSIONS } from '@defra/lis-hubs-infra-access/auth'
import { logger } from '@defra/lis-hubs-infra-core'

/**
 * Redirects unauthenticated requests to login, and throws a Boom 403 for
 * authenticated requests that lack back-office access - caught by the
 * shared onPreResponse handler, which renders the standard error page.
 * Returns a redirect response for unauthenticated requests, or `null`
 * when the request may proceed.
 *
 * @param {object} request
 * @param {object} h
 * @returns {object|null}
 */
export function requireBackOfficeAccess(request, h) {
  const authenticatedUser = request.app.hubAuth

  if (!authenticatedUser) {
    const returnUrl = encodeURIComponent(
      request.url.pathname + request.url.search
    )
    return h.redirect(`/auth/login?returnUrl=${returnUrl}`)
  }

  if (
    !hasPermission(authenticatedUser, { permission: PERMISSIONS.backOffice })
  ) {
    logger.warn(
      { userId: authenticatedUser.sub, path: request.path },
      'Back-office access denied'
    )
    throw Boom.forbidden()
  }

  return null
}
