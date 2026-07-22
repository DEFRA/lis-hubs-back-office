import { createOidcClient } from '@livestock/hubs-infra-access/auth'

import { config } from '#config/config.js'

function getProviderConfig(providerId) {
  if (!providerId) {
    throw new Error('Authentication provider id is required')
  }

  return {
    discoveryUrl: config.get(`auth.providers.${providerId}.discoveryUrl`),
    clientId: config.get(`auth.providers.${providerId}.clientId`),
    clientSecret: config.get(`auth.providers.${providerId}.clientSecret`),
    redirectPath: config.get(`auth.providers.${providerId}.redirectPath`),
    serviceId: config.get(`auth.providers.${providerId}.serviceId`)
  }
}

/**
 * Map provider-specific OIDC claims to the hub user shape.
 *
 * @param {object} payload verified ID token claims
 * @param {{ providerId: string, providerConfig: object }} context provider details
 * @returns {object} hub user
 */
export function mapUser(payload, { providerId, providerConfig }) {
  return {
    sub: payload.sub,
    email: payload.email ?? '',
    firstName: payload.firstName ?? payload.given_name ?? '',
    lastName: payload.lastName ?? payload.family_name ?? '',
    serviceId: payload.serviceId ?? providerConfig.serviceId,
    roles: Array.isArray(payload.roles) ? payload.roles : [],
    loa: payload.loa ?? '',
    amr: Array.isArray(payload.amr) ? payload.amr : [],
    authProvider: providerId
  }
}

export const {
  buildAuthorizationUrl,
  buildLogoutUrl,
  completeAuthorizationCodeGrant,
  getOidcMetadata
} = createOidcClient({
  getProviderConfig,
  getHubOrigin: () => config.get('auth.hubOrigin'),
  getPrimaryProviderId: () => config.get('auth.primaryProvider'),
  mapUser
})
