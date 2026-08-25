import {
  createHubAuthPlugin,
  createHubCookieOptions,
  GLOBAL_CPH_SCOPE,
  resolveAuthorization
} from '@defra/lis-hubs-infra-access/auth'

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
    ttlSeconds: config.get('auth.hubJwt.ttlSeconds'),
    isSecure: config.get('session.cookie.secure')
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

export const auth = createHubAuthPlugin({
  getHubJwtCookieName,
  getCookieOptions,
  getHubJwtConfig,
  resolveAuthSession,
  buildAuthorizationUrl,
  completeAuthorizationCodeGrant,
  buildLogoutUrl,
  loginRoutes: [{ path: '/auth/login' }]
})
