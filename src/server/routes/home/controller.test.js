import { beforeEach, describe, expect, test, vi } from 'vitest'

const {
  createSpokeAuthToken,
  getAccessibleModulesForHub,
  getHubAuthSession,
  logger,
  moduleDefinitions
} = vi.hoisted(() => ({
  createSpokeAuthToken: vi.fn(),
  getAccessibleModulesForHub: vi.fn(),
  getHubAuthSession: vi.fn(),
  logger: {
    error: vi.fn()
  },
  moduleDefinitions: [
    {
      id: 'status-cattle',
      label: 'Status for Cattle',
      path: '/cattle/status',
      port: 3210,
      taxonomy: 'status',
      species: 'ctt',
      hubs: ['front-office', 'back-office']
    },
    {
      id: 'register-cattle',
      label: 'Register for Cattle',
      path: '/cattle/register',
      port: 3201,
      taxonomy: 'register',
      species: 'ctt',
      hubs: ['front-office', 'back-office']
    }
  ]
}))

const configValues = {
  'auth.hubJwt.secret': 'back-office-hub-secret-please-change-1234567890',
  'auth.hubJwt.issuer': 'http://localhost:3102',
  'auth.hubJwt.audience': 'livestock-spokes',
  'auth.hubJwt.ttlSeconds': 14400,
  'auth.hubOrigin': 'http://localhost:3102'
}

vi.mock('@livestock/hub-core/auth/session', () => ({
  getHubAuthSession
}))

vi.mock('@livestock/ui-services/module-access', () => ({
  getAccessibleModulesForHub
}))

vi.mock('@livestock/hub-registry', () => ({
  MODULES: moduleDefinitions,
  SPECIES: [
    {
      code: 'ctt',
      label: 'Cattle'
    }
  ],
  hydrateModuleMetadata: vi.fn((module) => ({
    ...module,
    taxonomyLabel: module.taxonomy === 'status' ? 'Status' : 'Register',
    speciesLabel: 'Cattle'
  }))
}))

vi.mock('@livestock/ui-services/auth', () => ({
  createSpokeAuthToken
}))

vi.mock('@livestock/ui-services/logging', () => ({
  getLoggerForConfig: vi.fn(() => logger)
}))

vi.mock('#config/config.js', () => ({
  config: {
    get: vi.fn((path) => configValues[path])
  }
}))

import { homeController } from './controller.js'

describe('#backOfficeHomeController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  test('Should render the welcome view for unauthenticated users', async () => {
    const view = vi.fn(() => 'rendered')

    getHubAuthSession.mockReturnValue(null)
    getAccessibleModulesForHub.mockReturnValue([])

    const response = await homeController.handler(
      {},
      {
        view
      }
    )

    expect(response).toBe('rendered')
    expect(view).toHaveBeenCalledWith(
      'home/welcome',
      expect.objectContaining({
        pageTitle: 'Welcome',
        heading: 'Livestock back office',
        primaryLoginUrl: '/auth/login?returnUrl=/',
        fallbackLoginUrl: '/auth/login/fallback?returnUrl=/'
      })
    )
  })

  test('Should render status summaries and operational modules for authenticated users', async () => {
    const authenticatedUser = {
      sub: 'user-1',
      firstName: 'Case',
      lastName: 'Worker'
    }
    const view = vi.fn(() => 'rendered')

    getHubAuthSession.mockReturnValue(authenticatedUser)
    getAccessibleModulesForHub.mockReturnValue(moduleDefinitions)
    createSpokeAuthToken.mockResolvedValue('Bearer token')
    global.fetch.mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('<p>Status ok</p>')
    })

    const response = await homeController.handler(
      {},
      {
        view
      }
    )

    expect(response).toBe('rendered')
    expect(createSpokeAuthToken).toHaveBeenCalledWith(
      expect.objectContaining({
        spokeId: 'cattle-status',
        taxonomyId: 'status',
        user: authenticatedUser
      }),
      expect.objectContaining({
        audience: 'livestock-spokes'
      })
    )
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3102/cattle/status/',
      expect.objectContaining({
        method: 'GET',
        headers: {
          Authorization: 'Bearer token'
        }
      })
    )
    expect(view).toHaveBeenCalledWith(
      'home/dashboard',
      expect.objectContaining({
        authenticatedUser,
        statusSpokes: [
          expect.objectContaining({
            id: 'status-cattle',
            status: {
              ok: true,
              value: '<p>Status ok</p>'
            }
          })
        ],
        operationalModules: [
          expect.objectContaining({
            id: 'register-cattle'
          })
        ]
      })
    )
  })
})
