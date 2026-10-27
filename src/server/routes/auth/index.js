import {
  createHubAuth,
  createHubCookieOptions
} from '@defra/lis-hubs-infra-access/authentication'
import {
  GLOBAL_CPH_SCOPE,
  PERMISSIONS,
  hasPermission,
  resolveAuthorization
} from '@defra/lis-hubs-infra-access/authorization'
import { logger } from '@defra/lis-hubs-infra-core'

import { config } from '#config/config.js'
import {
  buildAuthorizationUrl,
  buildLogoutUrl,
  completeAuthorizationCodeGrant
} from '#server/common/helpers/auth/oidc.js'

function resolveAuthSession({ user }) {
  return resolveAuthorization({
    source: 'entra',
    // Accept both Entra's BCMS roles and LIS roles from identity adapters.
    holdingRoles: (user.roles ?? []).map((role) => ({
      role,
      cph: GLOBAL_CPH_SCOPE
    }))
  })
}

function getHubJwtCookieName() {
  return config.get('auth.hubJwt.cookieName')
}

function getCookieOptions() {
  return createHubCookieOptions({
    ttlSeconds: config.get('auth.hubJwt.ttlSeconds')
  })
}

function getHubJwtConfig() {
  return {
    secret: config.get('auth.hubJwt.secret'),
    issuer: config.get('auth.hubJwt.issuer'),
    audience: config.get('auth.hubJwt.audience'),
    ttlSeconds: config.get('auth.hubJwt.ttlSeconds')
  }
}

/**
 * Hub-wide rule: every authenticated back-office request needs back-office
 * access. A `false` result keeps the user signed in but sends them to the
 * not-authorised page with no spoke JWT.
 *
 * @param {object} user
 * @param {object} request
 * @returns {boolean}
 */
export function authorizeBackOfficeAccess(user, request) {
  if (hasPermission(user, { permission: PERMISSIONS.backOffice })) {
    return true
  }

  logger.warn({ path: request.path }, 'Back-office access denied')

  return false
}

export const auth = createHubAuth({
  hubId: 'back-office',
  getHubJwtCookieName,
  getCookieOptions,
  getHubJwtConfig,
  resolveAuthSession,
  buildAuthorizationUrl,
  completeAuthorizationCodeGrant,
  buildLogoutUrl,
  loginRoutes: [{ path: '/auth/login' }],
  authorize: authorizeBackOfficeAccess
})
