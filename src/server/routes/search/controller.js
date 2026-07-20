import { getHubAuthSession } from '@livestock/hubs-infra-access/auth'

import {
  getCph,
  getUser,
  PAGE_SIZE,
  searchCphs,
  searchUsers
} from '#server/services/search.js'

const notFoundStatusCode = 404
const minimumPageCountForPagination = 2

const cphSearchTypes = {
  address: {
    heading: 'Find a CPH by address',
    sort: 'postcode-ascending',
    fields: [
      { name: 'address', label: 'Address' },
      { name: 'postcode', label: 'Postcode', width: 10 }
    ]
  },
  person: {
    heading: 'Find a CPH by person name',
    sort: 'person-name-ascending',
    fields: [
      { name: 'firstName', label: 'First name', width: 20 },
      { name: 'lastName', label: 'Last name', width: 20 }
    ]
  },
  browse: {
    heading: 'Browse CPHs',
    sort: 'cph-ascending',
    fields: []
  }
}

const userSearchTypes = {
  email: {
    heading: 'Find a user by email',
    sort: 'email-ascending',
    fields: [{ name: 'email', label: 'Email address', width: 30 }]
  },
  address: {
    heading: 'Find a user by address',
    sort: 'postcode-ascending',
    fields: [
      { name: 'address', label: 'Address' },
      { name: 'postcode', label: 'Postcode', width: 10 }
    ]
  },
  cph: {
    heading: 'Find a user by CPH',
    sort: 'name-ascending',
    fields: [{ name: 'cph', label: 'CPH number', width: 20 }]
  }
}

export const cphSearchController = createSearchController({
  searchTypes: cphSearchTypes,
  defaultSearchBy: 'browse',
  search: searchCphs,
  view: 'search/cphs',
  resultName: 'CPHs'
})

export const userSearchController = createSearchController({
  searchTypes: userSearchTypes,
  defaultSearchBy: 'email',
  search: searchUsers,
  view: 'search/users',
  resultName: 'users'
})

export const cphDetailsController = createDetailsController({
  load: getCph,
  view: 'search/cph-details',
  resultName: 'CPH'
})

export const userDetailsController = createDetailsController({
  load: getUser,
  view: 'search/user-details',
  resultName: 'user'
})

function createSearchController(options) {
  return {
    async handler(request, h) {
      if (!getHubAuthSession(request)) {
        return redirectToLogin(request, h)
      }

      const searchBy = options.searchTypes[request.query.searchBy]
        ? request.query.searchBy
        : options.defaultSearchBy
      const searchType = options.searchTypes[searchBy]
      const page = positiveInteger(request.query.page)
      const applied = request.query.apply === '1' || searchBy === 'browse'
      const filters = Object.fromEntries(
        searchType.fields.map(({ name }) => [name, clean(request.query[name])])
      )
      const result = applied
        ? await options.search({
            searchBy,
            filters,
            page,
            pageSize: PAGE_SIZE,
            sort: searchType.sort
          })
        : { items: [], total: 0 }

      return h.view(options.view, {
        pageTitle: searchType.heading,
        heading: searchType.heading,
        searchBy,
        searchType,
        filters,
        applied,
        results: result.items,
        total: result.total,
        pagination: buildPagination({
          total: result.total,
          page,
          query: request.query
        }),
        resultName: options.resultName
      })
    }
  }
}

function createDetailsController({ load, view, resultName }) {
  return {
    async handler(request, h) {
      if (!getHubAuthSession(request)) {
        return redirectToLogin(request, h)
      }

      const item = await load(request.params.id)

      if (!item) {
        return h
          .view('search/not-found', {
            pageTitle: `${resultName} not found`,
            heading: `${resultName} not found`,
            resultName
          })
          .code(notFoundStatusCode)
      }

      return h.view(view, {
        pageTitle: item.name ?? item.cph ?? `${resultName} details`,
        item
      })
    }
  }
}

function redirectToLogin(request, h) {
  const returnUrl = encodeURIComponent(
    request.url.pathname + request.url.search
  )
  return h.redirect(`/auth/login?returnUrl=${returnUrl}`)
}

function positiveInteger(value) {
  const number = Number.parseInt(value, 10)
  return Number.isInteger(number) && number > 0 ? number : 1
}

function clean(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function buildPagination({ total, page, query }) {
  const pageCount = Math.ceil(total / PAGE_SIZE)

  if (pageCount < minimumPageCountForPagination) {
    return null
  }

  const href = (targetPage) => {
    const params = new URLSearchParams(query)
    params.set('page', targetPage)
    return `?${params.toString()}`
  }
  const items = []

  for (let number = 1; number <= pageCount; number += 1) {
    items.push({ number, href: href(number), current: number === page })
  }

  return {
    items,
    previous: page > 1 ? { href: href(page - 1) } : null,
    next: page < pageCount ? { href: href(page + 1) } : null
  }
}
