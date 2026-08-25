import { beforeEach, describe, expect, test, vi } from 'vitest'

const { getHubAuthSession, hasRole } = vi.hoisted(() => ({
  getHubAuthSession: vi.fn(),
  hasRole: vi.fn()
}))

vi.mock('@defra/lis-hubs-infra-access/auth', () => ({
  getHubAuthSession,
  hasRole
}))

import { requireBackOfficeAccess } from './require-back-office-access.js'

function responseToolkit() {
  const response = { code: vi.fn(() => response) }

  return {
    redirect: vi.fn(() => 'redirected'),
    response: vi.fn(() => response)
  }
}

describe('requireBackOfficeAccess()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('redirects unauthenticated requests to login with a returnUrl', () => {
    // Arrange
    const request = { url: new URL('http://localhost/cphs?searchBy=browse') }
    const h = responseToolkit()
    getHubAuthSession.mockReturnValue(null)

    // Act
    const result = requireBackOfficeAccess(request, h)

    // Assert
    expect(result).toBe('redirected')
    expect(h.redirect).toHaveBeenCalledWith(
      '/auth/login?returnUrl=%2Fcphs%3FsearchBy%3Dbrowse'
    )
  })

  test('denies authenticated requests without the back-office role', () => {
    // Arrange
    const authenticatedUser = { sub: 'user-1' }
    const request = { url: new URL('http://localhost/') }
    const h = responseToolkit()
    getHubAuthSession.mockReturnValue(authenticatedUser)
    hasRole.mockReturnValue(false)

    // Act
    const result = requireBackOfficeAccess(request, h)

    // Assert
    expect(h.response).toHaveBeenCalledWith({ message: 'Role denied' })
    expect(result.code).toHaveBeenCalledWith(403)
    expect(hasRole).toHaveBeenCalledWith(authenticatedUser, {
      role: 'lis-role-back-office'
    })
  })

  test('allows authenticated requests with the back-office role', () => {
    // Arrange
    const authenticatedUser = { sub: 'user-1' }
    const request = { url: new URL('http://localhost/') }
    const h = responseToolkit()
    getHubAuthSession.mockReturnValue(authenticatedUser)
    hasRole.mockReturnValue(true)

    // Act
    const result = requireBackOfficeAccess(request, h)

    // Assert
    expect(result).toBeNull()
    expect(h.redirect).not.toHaveBeenCalled()
    expect(h.response).not.toHaveBeenCalled()
  })
})
