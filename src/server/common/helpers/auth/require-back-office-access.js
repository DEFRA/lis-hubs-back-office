import { getHubAuthSession, hasRole } from '@defra/lis-hubs-infra-access/auth'

const roleDeniedStatusCode = 403
const backOfficeRole = 'lis-role-back-office'

/**
 * Redirects unauthenticated requests to login, and denies authenticated
 * requests that lack the back-office role. Returns a response to send
 * when access is not granted, or `null` when the request may proceed.
 *
 * @param {object} request
 * @param {object} h
 * @returns {object|null}
 */
export function requireBackOfficeAccess(request, h) {
  const authenticatedUser = getHubAuthSession(request)

  if (!authenticatedUser) {
    const returnUrl = encodeURIComponent(
      request.url.pathname + request.url.search
    )
    return h.redirect(`/auth/login?returnUrl=${returnUrl}`)
  }

  if (!hasRole(authenticatedUser, { role: backOfficeRole })) {
    return h.response({ message: 'Role denied' }).code(roleDeniedStatusCode)
  }

  return null
}
