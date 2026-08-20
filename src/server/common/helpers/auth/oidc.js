import { createOidcClient } from '@defra/lis-hubs-infra-access/auth'

import { config } from '#config/config.js'
import { getProviderConfig } from './get-provider-config.js'
import { mapUser } from './map-user.js'

export const {
  buildAuthorizationUrl,
  buildLogoutUrl,
  completeAuthorizationCodeGrant
} = createOidcClient({
  getProviderConfig,
  getHubOrigin: config.get.bind(config, 'auth.hubOrigin'),
  getPrimaryProviderId: config.get.bind(config, 'auth.primaryProvider'),
  mapUser
})
