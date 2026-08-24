import { config } from '#config/config.js'

// Fixed by what's registered in Entra, not by environment.
const OIDC_SCOPE = 'openid email profile'

/**
 * @param {string} providerId
 * @returns {object}
 */
export function getProviderConfig(providerId) {
  if (!providerId) {
    throw new Error('Authentication provider id is required')
  }

  return {
    discoveryUrl: config.get(`auth.providers.${providerId}.discoveryUrl`),
    clientId: config.get(`auth.providers.${providerId}.clientId`),
    clientSecret: config.get(`auth.providers.${providerId}.clientSecret`),
    redirectPath: config.get(`auth.providers.${providerId}.redirectPath`),
    serviceId: config.get(`auth.providers.${providerId}.serviceId`),
    scope: OIDC_SCOPE
  }
}
