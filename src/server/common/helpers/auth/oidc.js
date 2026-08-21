import { createOidcClient } from '@defra/lis-hubs-infra-access/auth'

import { config } from '#config/config.js'
import { getProviderConfig } from './get-provider-config.js'
import { mapUser } from './map-user.js'

export const {
  buildAuthorizationUrl,
  buildLogoutUrl,
  completeAuthorizationCodeGrant
} = await createOidcClient({
  provider: getProviderConfig(config.get('auth.primaryProvider')),
  hubOrigin: config.get('auth.hubOrigin'),
  mapUser
})
