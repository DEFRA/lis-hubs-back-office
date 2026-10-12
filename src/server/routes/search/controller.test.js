import { beforeEach, describe, expect, test, vi } from 'vitest'

const { getUser, searchUsers } = vi.hoisted(() => ({
  getUser: vi.fn(),
  searchUsers: vi.fn()
}))

vi.mock('#server/services/search.js', () => ({
  PAGE_SIZE: 20,
  searchUsers,
  getUser
}))

import { userDetailsController, userSearchController } from './controller.js'

function responseToolkit() {
  return {
    view: vi.fn(() => 'rendered')
  }
}

const authenticatedUser = { sub: 'user-1' }

describe('#searchControllers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    searchUsers.mockResolvedValue({ items: [], total: 0 })
  })

  test('does not search until Apply is selected', async () => {
    const h = responseToolkit()
    await userSearchController.handler(
      {
        auth: { credentials: { user: authenticatedUser } },
        query: { searchBy: 'address', postcode: 'SW1A 1AA' },
        url: new URL('http://localhost/users?searchBy=address')
      },
      h
    )

    expect(searchUsers).not.toHaveBeenCalled()
    expect(h.view).toHaveBeenCalledWith(
      'search/users',
      expect.objectContaining({ applied: false, searchBy: 'address' })
    )
  })

  test('searches users with a page size of 20 and the address sort', async () => {
    const h = responseToolkit()
    await userSearchController.handler(
      {
        auth: { credentials: { user: authenticatedUser } },
        query: {
          searchBy: 'address',
          postcode: ' SW1A 1AA ',
          apply: '1',
          page: '2'
        },
        url: new URL('http://localhost/users')
      },
      h
    )

    expect(searchUsers).toHaveBeenCalledWith({
      searchBy: 'address',
      filters: { address: '', postcode: 'SW1A 1AA' },
      page: 2,
      pageSize: 20,
      sort: 'postcode-ascending'
    })
  })

  test('uses the selected user filter and sort', async () => {
    const h = responseToolkit()
    await userSearchController.handler(
      {
        auth: { credentials: { user: authenticatedUser } },
        query: { searchBy: 'cph', cph: '12/345/6789', apply: '1' },
        url: new URL('http://localhost/users')
      },
      h
    )

    expect(searchUsers).toHaveBeenCalledWith(
      expect.objectContaining({
        searchBy: 'cph',
        filters: { cph: '12/345/6789' },
        pageSize: 20,
        sort: 'name-ascending'
      })
    )
  })

  test('builds pagination links when there is more than one page of results', async () => {
    const h = responseToolkit()
    searchUsers.mockResolvedValue({ items: [], total: 45 })

    await userSearchController.handler(
      {
        auth: { credentials: { user: authenticatedUser } },
        query: { searchBy: 'email', apply: '1', page: '2' },
        url: new URL('http://localhost/users?searchBy=email&apply=1&page=2')
      },
      h
    )

    expect(h.view).toHaveBeenCalledWith(
      'search/users',
      expect.objectContaining({
        pagination: {
          items: [
            {
              number: 1,
              href: '?searchBy=email&apply=1&page=1',
              current: false
            },
            {
              number: 2,
              href: '?searchBy=email&apply=1&page=2',
              current: true
            },
            {
              number: 3,
              href: '?searchBy=email&apply=1&page=3',
              current: false
            }
          ],
          previous: { href: '?searchBy=email&apply=1&page=1' },
          next: { href: '?searchBy=email&apply=1&page=3' }
        }
      })
    )
  })

  test('omits pagination when there is only one page of results', async () => {
    const h = responseToolkit()
    searchUsers.mockResolvedValue({ items: [], total: 5 })

    await userSearchController.handler(
      {
        auth: { credentials: { user: authenticatedUser } },
        query: { searchBy: 'email', apply: '1' },
        url: new URL('http://localhost/users?searchBy=email&apply=1')
      },
      h
    )

    expect(h.view).toHaveBeenCalledWith(
      'search/users',
      expect.objectContaining({ pagination: null })
    )
  })
})

describe('#detailsControllers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders user details when the user is found', async () => {
    const h = responseToolkit()
    getUser.mockResolvedValue({ name: 'Test Farmer' })

    await userDetailsController.handler(
      {
        auth: { credentials: { user: authenticatedUser } },
        params: { id: 'user-1' }
      },
      h
    )

    expect(getUser).toHaveBeenCalledWith('user-1')
    expect(h.view).toHaveBeenCalledWith('search/user-details', {
      pageTitle: 'Test Farmer',
      item: { name: 'Test Farmer' }
    })
  })

  test('renders a not-found page when the user does not exist', async () => {
    const h = { view: vi.fn(() => h), code: vi.fn(() => h) }
    getUser.mockResolvedValue(undefined)

    await userDetailsController.handler(
      {
        auth: { credentials: { user: authenticatedUser } },
        params: { id: 'unknown' }
      },
      h
    )

    expect(h.view).toHaveBeenCalledWith(
      'search/not-found',
      expect.objectContaining({ resultName: 'user' })
    )
    expect(h.code).toHaveBeenCalledWith(404)
  })
})
