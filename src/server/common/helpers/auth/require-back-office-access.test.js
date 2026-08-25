import { beforeEach, describe, expect, test, vi } from 'vitest'

const { hasPermission } = vi.hoisted(() => ({
  hasPermission: vi.fn()
}))

vi.mock('@defra/lis-hubs-infra-access/auth', () => ({
  hasPermission,
  PERMISSIONS: { backOffice: 'lis-perm-back-office' }
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
    const request = {
      app: { hubAuth: null },
      url: new URL('http://localhost/cphs?searchBy=browse')
    }
    const h = responseToolkit()

    // Act
    const result = requireBackOfficeAccess(request, h)

    // Assert
    expect(result).toBe('redirected')
    expect(h.redirect).toHaveBeenCalledWith(
      '/auth/login?returnUrl=%2Fcphs%3FsearchBy%3Dbrowse'
    )
  })

  test('denies authenticated requests without back-office access', () => {
    // Arrange
    const authenticatedUser = { sub: 'user-1' }
    const request = {
      app: { hubAuth: authenticatedUser },
      url: new URL('http://localhost/'),
      path: '/',
      logger: { warn: vi.fn() }
    }
    const h = responseToolkit()
    hasPermission.mockReturnValue(false)

    // Act
    let error
    try {
      requireBackOfficeAccess(request, h)
    } catch (e) {
      error = e
    }

    // Assert
    expect(error?.isBoom).toBe(true)
    expect(error?.output.statusCode).toBe(403)
    expect(request.logger.warn).toHaveBeenCalledWith(
      { userId: 'user-1', path: '/' },
      'Back-office access denied'
    )
    expect(hasPermission).toHaveBeenCalledWith(authenticatedUser, {
      permission: 'lis-perm-back-office'
    })
  })

  test('allows authenticated requests with back-office access', () => {
    // Arrange
    const authenticatedUser = { sub: 'user-1' }
    const request = {
      app: { hubAuth: authenticatedUser },
      url: new URL('http://localhost/')
    }
    const h = responseToolkit()
    hasPermission.mockReturnValue(true)

    // Act
    const result = requireBackOfficeAccess(request, h)

    // Assert
    expect(result).toBeNull()
    expect(h.redirect).not.toHaveBeenCalled()
    expect(h.response).not.toHaveBeenCalled()
  })
})
