import { beforeEach, describe, expect, test, vi } from 'vitest'

const { getCph, getUser, searchCphs, searchUsers } = vi.hoisted(() => ({
  getCph: vi.fn(),
  getUser: vi.fn(),
  searchCphs: vi.fn(),
  searchUsers: vi.fn()
}))

vi.mock('#server/services/search.js', () => ({
  PAGE_SIZE: 20,
  searchCphs,
  searchUsers,
  getCph,
  getUser
}))

import {
  cphDetailsController,
  cphSearchController,
  userDetailsController,
  userSearchController
} from './controller.js'

function responseToolkit() {
  return {
    view: vi.fn(() => 'rendered')
  }
}

const authenticatedUser = { sub: 'user-1' }

describe('#searchControllers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    searchCphs.mockResolvedValue({ items: [], total: 0 })
    searchUsers.mockResolvedValue({ items: [], total: 0 })
  })

  test('does not search until Apply is selected', async () => {
    const h = responseToolkit()
    await cphSearchController.handler(
      {
        auth: { credentials: { user: authenticatedUser } },
        query: { searchBy: 'address', postcode: 'SW1A 1AA' },
        url: new URL('http://localhost/cphs?searchBy=address')
      },
      h
    )

    expect(searchCphs).not.toHaveBeenCalled()
    expect(h.view).toHaveBeenCalledWith(
      'search/cphs',
      expect.objectContaining({ applied: false, searchBy: 'address' })
    )
  })

  test('searches CPHs with a page size of 20 and the address sort', async () => {
    const h = responseToolkit()
    await cphSearchController.handler(
      {
        auth: { credentials: { user: authenticatedUser } },
        query: {
          searchBy: 'address',
          postcode: ' SW1A 1AA ',
          apply: '1',
          page: '2'
        },
        url: new URL('http://localhost/cphs')
      },
      h
    )

    expect(searchCphs).toHaveBeenCalledWith({
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
    searchCphs.mockResolvedValue({ items: [], total: 45 })

    await cphSearchController.handler(
      {
        auth: { credentials: { user: authenticatedUser } },
        query: { searchBy: 'browse', page: '2' },
        url: new URL('http://localhost/cphs?searchBy=browse&page=2')
      },
      h
    )

    expect(h.view).toHaveBeenCalledWith(
      'search/cphs',
      expect.objectContaining({
        pagination: {
          items: [
            {
              number: 1,
              href: '?searchBy=browse&page=1',
              current: false
            },
            { number: 2, href: '?searchBy=browse&page=2', current: true },
            {
              number: 3,
              href: '?searchBy=browse&page=3',
              current: false
            }
          ],
          previous: { href: '?searchBy=browse&page=1' },
          next: { href: '?searchBy=browse&page=3' }
        }
      })
    )
  })

  test('omits pagination when there is only one page of results', async () => {
    const h = responseToolkit()
    searchCphs.mockResolvedValue({ items: [], total: 5 })

    await cphSearchController.handler(
      {
        auth: { credentials: { user: authenticatedUser } },
        query: { searchBy: 'browse' },
        url: new URL('http://localhost/cphs?searchBy=browse')
      },
      h
    )

    expect(h.view).toHaveBeenCalledWith(
      'search/cphs',
      expect.objectContaining({ pagination: null })
    )
  })
})

describe('#detailsControllers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders CPH details when the CPH is found', async () => {
    const h = responseToolkit()
    getCph.mockResolvedValue({ cph: '12/345/6789' })

    await cphDetailsController.handler(
      {
        auth: { credentials: { user: authenticatedUser } },
        params: { id: '12/345/6789' }
      },
      h
    )

    expect(getCph).toHaveBeenCalledWith('12/345/6789')
    expect(h.view).toHaveBeenCalledWith('search/cph-details', {
      pageTitle: '12/345/6789',
      item: { cph: '12/345/6789' }
    })
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

  test('renders a not-found page when the CPH does not exist', async () => {
    const h = { view: vi.fn(() => h), code: vi.fn(() => h) }
    getCph.mockResolvedValue(undefined)

    await cphDetailsController.handler(
      {
        auth: { credentials: { user: authenticatedUser } },
        params: { id: 'unknown' }
      },
      h
    )

    expect(h.view).toHaveBeenCalledWith(
      'search/not-found',
      expect.objectContaining({ resultName: 'CPH' })
    )
    expect(h.code).toHaveBeenCalledWith(404)
  })
})
