import { config } from '#config/config.js'

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
    serviceId: config.get(`auth.providers.${providerId}.serviceId`)
  }
}
