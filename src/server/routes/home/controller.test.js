import { beforeEach, describe, expect, test, vi } from 'vitest'

const { getActionsToComplete, getHubAuthSession } = vi.hoisted(() => ({
  getActionsToComplete: vi.fn(),
  getHubAuthSession: vi.fn()
}))

vi.mock('@livestock/hubs-infra-access/auth', () => ({ getHubAuthSession }))
vi.mock('#server/services/actions-to-complete.js', () => ({
  getActionsToComplete
}))

import { getGreeting, homeController } from './controller.js'

describe('#backOfficeHomeController', () => {
  beforeEach(() => vi.clearAllMocks())

  test('renders the welcome view for unauthenticated users', async () => {
    const view = vi.fn(() => 'rendered')
    getHubAuthSession.mockReturnValue(null)

    const response = await homeController.handler({}, { view })

    expect(response).toBe('rendered')
    expect(view).toHaveBeenCalledWith(
      'home/welcome',
      expect.objectContaining({
        heading: 'Livestock back office',
        loginUrl: '/auth/login?returnUrl=/'
      })
    )
  })

  test('renders the dashboard with the Entra first name and actions', async () => {
    const authenticatedUser = { sub: 'user-1', firstName: 'Case' }
    const actions = [{ title: 'Review application', url: '/actions/1' }]
    const view = vi.fn(() => 'rendered')
    getHubAuthSession.mockReturnValue(authenticatedUser)
    getActionsToComplete.mockResolvedValue(actions)

    const response = await homeController.handler({}, { view })

    expect(response).toBe('rendered')
    expect(getActionsToComplete).toHaveBeenCalledWith({
      user: authenticatedUser
    })
    expect(view).toHaveBeenCalledWith(
      'home/dashboard',
      expect.objectContaining({ authenticatedUser, actionsToComplete: actions })
    )
  })

  test.each([
    [5, 'Good morning'],
    [12, 'Good afternoon'],
    [18, 'Good evening']
  ])('uses the greeting for hour %s', (hour, expected) => {
    const date = new Date(2026, 6, 18, hour)
    expect(getGreeting(date)).toBe(expected)
  })
})
