import { beforeEach, describe, expect, test, vi } from 'vitest'

const { getHubAuthSession, searchCphs, searchUsers } = vi.hoisted(() => ({
  getHubAuthSession: vi.fn(),
  searchCphs: vi.fn(),
  searchUsers: vi.fn()
}))

vi.mock('@livestock/hubs-infra-access/auth', () => ({ getHubAuthSession }))
vi.mock('#server/services/search.js', () => ({
  PAGE_SIZE: 20,
  searchCphs,
  searchUsers,
  getCph: vi.fn(),
  getUser: vi.fn()
}))

import { cphSearchController, userSearchController } from './controller.js'

function responseToolkit() {
  return {
    view: vi.fn(() => 'rendered'),
    redirect: vi.fn(() => 'redirected')
  }
}

describe('#searchControllers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getHubAuthSession.mockReturnValue({ sub: 'user-1' })
    searchCphs.mockResolvedValue({ items: [], total: 0 })
    searchUsers.mockResolvedValue({ items: [], total: 0 })
  })

  test('does not search until Apply is selected', async () => {
    const h = responseToolkit()
    await cphSearchController.handler(
      {
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

  test('redirects unauthenticated users back through login', async () => {
    getHubAuthSession.mockReturnValue(null)
    const h = responseToolkit()

    await cphSearchController.handler(
      {
        query: {},
        url: new URL('http://localhost/cphs?searchBy=browse')
      },
      h
    )

    expect(h.redirect).toHaveBeenCalledWith(
      '/auth/login?returnUrl=%2Fcphs%3FsearchBy%3Dbrowse'
    )
  })
})
