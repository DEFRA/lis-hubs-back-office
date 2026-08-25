import { beforeEach, describe, expect, test, vi } from 'vitest'

const { getActionsToComplete, getHubAuthSession, hasPermission } = vi.hoisted(
  () => ({
    getActionsToComplete: vi.fn(),
    getHubAuthSession: vi.fn(),
    hasPermission: vi.fn()
  })
)

vi.mock('@defra/lis-hubs-infra-access/auth', () => ({
  getHubAuthSession,
  hasPermission
}))
vi.mock('#server/services/actions-to-complete.js', () => ({
  getActionsToComplete
}))

import { getGreeting, homeController } from './controller.js'

describe('#backOfficeHomeController', () => {
  beforeEach(() => vi.clearAllMocks())

  test('redirects unauthenticated users to login', async () => {
    const redirect = vi.fn(() => 'redirected')
    getHubAuthSession.mockReturnValue(null)

    const response = await homeController.handler(
      { url: new URL('http://localhost/') },
      { redirect }
    )

    expect(response).toBe('redirected')
    expect(redirect).toHaveBeenCalledWith('/auth/login?returnUrl=%2F')
  })

  test('renders the dashboard with the Entra first name and actions', async () => {
    const authenticatedUser = { sub: 'user-1', firstName: 'Case' }
    const actions = [{ title: 'Review application', url: '/actions/1' }]
    const view = vi.fn(() => 'rendered')
    getHubAuthSession.mockReturnValue(authenticatedUser)
    getActionsToComplete.mockResolvedValue(actions)
    hasPermission.mockImplementation(
      (_user, { permission }) => permission === 'lis-perm-back-office'
    )

    const response = await homeController.handler({}, { view })

    expect(response).toBe('rendered')
    expect(getActionsToComplete).toHaveBeenCalledWith({
      user: authenticatedUser
    })
    expect(view).toHaveBeenCalledWith(
      'home/dashboard',
      expect.objectContaining({
        authenticatedUser,
        actionsToComplete: actions,
        canApprovePassport: false
      })
    )
    expect(hasPermission).toHaveBeenCalledWith(
      authenticatedUser,
      expect.objectContaining({ permission: 'lis-perm-passport-approver' })
    )
  })

  test('shows passport approval to passport approvers', async () => {
    const authenticatedUser = { sub: 'manager-1', firstName: 'Manager' }
    const view = vi.fn(() => 'rendered')
    getHubAuthSession.mockReturnValue(authenticatedUser)
    getActionsToComplete.mockResolvedValue([])
    hasPermission.mockImplementation(
      (_user, { permission }) =>
        permission === 'lis-perm-passport-approver' ||
        permission === 'lis-perm-back-office'
    )

    await homeController.handler({}, { view })

    expect(view).toHaveBeenCalledWith(
      'home/dashboard',
      expect.objectContaining({
        canApprovePassport: true
      })
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
