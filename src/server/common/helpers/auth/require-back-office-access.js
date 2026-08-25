import { hasPermission, PERMISSIONS } from '@defra/lis-hubs-infra-access/auth'

const permissionDeniedStatusCode = 403

/**
 * Redirects unauthenticated requests to login, and denies authenticated
 * requests that lack back-office access. Returns a response to send
 * when access is not granted, or `null` when the request may proceed.
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
    return h
      .response({ message: 'Permission denied' })
      .code(permissionDeniedStatusCode)
  }

  return null
}
