import {
  derivePseudonymousUserId,
  requestContext
} from '@defra/lis-hubs-infra-core'

import { config } from '#config/config.js'

/**
 * Derives a pseudonymous user_id from the email and, when successful, sets
 * it in the request context so it reaches log output.
 * @param {string} email
 * @returns {string | null}
 */
function deriveUserId(email) {
  const userId = derivePseudonymousUserId(
    email,
    config.get('auth.userIdHashSecret')
  )

  if (userId) {
    requestContext.set('user_id', userId)
  }

  return userId
}

/**
 * Map provider-specific OIDC claims to the hub user shape.
 *
 * @param {object} payload verified ID token claims
 * @param {{ providerId: string, providerConfig: object }} context provider details
 * @returns {object} hub user
 */
export function mapUser(payload, { providerId, providerConfig }) {
  const userId = deriveUserId(payload.email)

  return {
    sub: payload.sub,
    email: payload.email ?? '',
    firstName: payload.firstName ?? payload.given_name ?? '',
    lastName: payload.lastName ?? payload.family_name ?? '',
    serviceId: payload.serviceId ?? providerConfig.serviceId,
    roles: Array.isArray(payload.roles) ? payload.roles : [],
    loa: payload.loa ?? '',
    amr: Array.isArray(payload.amr) ? payload.amr : [],
    authProvider: providerId,
    user_id: userId
  }
}
