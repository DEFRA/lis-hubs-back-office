import { getHubAuthSession } from '@livestock/infra-core/auth/session'
import { getAccessibleModulesForHub } from '@livestock/ui-services/module-access'
import { hydrateModuleMetadata, MODULES, SPECIES } from '@livestock/hub-registry'
import { createSpokeAuthToken } from '@livestock/ui-services/auth'
import { getLoggerForConfig } from '@livestock/ui-services/logging'

import { config } from '#config/config.js'

const currentHubId = 'back-office'

export const homeController = {
  async handler(request, h) {
    const viewModel = buildHomeViewModel(request)

    if (viewModel.authenticatedUser) {
      for (const spoke of viewModel.statusSpokes) {
        spoke.status = await loadSpokeStatus(spoke, viewModel.authenticatedUser)
      }

      return h.view('home/dashboard', viewModel)
    }

    return h.view('home/welcome', {
      ...viewModel,
      pageTitle: 'Welcome',
      heading: 'Livestock back office',
      supportedSpecies: SPECIES,
      primaryLoginUrl: '/auth/login?returnUrl=/',
      fallbackLoginUrl: '/auth/login/fallback?returnUrl=/'
    })
  }
}

function buildHomeViewModel(request) {
  const authenticatedUser = getHubAuthSession(request)
  const modules = getAccessibleModulesForHub({
    hubId: currentHubId,
    user: authenticatedUser,
    modules: MODULES
  }).map((module) => {
    const hydratedModule = hydrateModuleMetadata(module)

    return {
      ...hydratedModule,
      taxonomy: {
        id: module.taxonomy,
        label: hydratedModule.taxonomyLabel
      },
      species: {
        id: module.species,
        label: hydratedModule.speciesLabel
      },
      url: module.spokeUrl ?? module.path
    }
  })

  return {
    authenticatedUser,
    loginUrl: '/auth/login?returnUrl=/',
    logoutUrl: '/auth/logout',
    modules,
    statusSpokes: modules.filter((module) => module.taxonomy.id === 'status'),
    operationalModules: modules.filter((module) => module.taxonomy.id !== 'status')
  }
}

function getSpokeAuthConfig() {
  return {
    secret: config.get('auth.hubJwt.secret'),
    issuer: config.get('auth.hubJwt.issuer'),
    audience: config.get('auth.hubJwt.audience'),
    ttlSeconds: config.get('auth.hubJwt.ttlSeconds')
  }
}

async function loadSpokeStatus(spoke, authenticatedUser) {
  const logger = getLoggerForConfig(config)
  const spokeUrl = buildStatusUrl(spoke)
  const headers = {
    Authorization: await createSpokeAuthToken(
      {
        taxonomyId: spoke.taxonomy.id,
        spokeId: spoke.id,
        user: authenticatedUser
      },
      getSpokeAuthConfig()
    )
  }
  const response = await fetch(spokeUrl, {
    method: 'GET',
    headers
  })

  if (!response.ok) {
    logger.error(
      `Failed to fetch spoke status for ${spoke.id}: ${response.status} ${response.statusText}`
    )

    return {
      ok: false,
      value: 'Error fetching spoke status, please try again later.'
    }
  }

  return {
    ok: true,
    value: await response.text()
  }
}

function buildStatusUrl(spoke) {
  const spokePath = spoke.path.endsWith('/') ? spoke.path : `${spoke.path}/`

  return new URL(spokePath, config.get('auth.hubOrigin')).toString()
}
