import Joi from 'joi'

import { PAGE_SIZE, searchHoldings } from '#server/services/holdings.js'

import { buildPagination } from '../search/controller.js'

const maximumSearchLength = 100

export const holdingsQuerySchema = Joi.object({
  search: Joi.string().trim().max(maximumSearchLength).truncate().allow(''),
  page: Joi.number().integer().min(1).default(1).failover(1)
}).prefs({ stripUnknown: true })

export const holdingsController = {
  options: {
    validate: {
      query: holdingsQuerySchema
    }
  },
  async handler(request, h) {
    const search = request.query.search ?? ''
    const searched = search !== ''
    const {
      values,
      totalCount: total,
      totalPages,
      page
    } = searched
      ? await findPage({ search, page: request.query.page })
      : { values: [], totalCount: 0, totalPages: 0, page: 1 }

    const pageCount = Math.max(1, totalPages)

    return h.view('holdings/holdings', {
      pageTitle:
        pageCount > 1
          ? `Page ${page} of ${pageCount} - Find a holding`
          : 'Find a holding',
      search,
      searched,
      results: values.map(toRow),
      total,
      resultsSummary: buildResultsSummary({ total, page }),
      pagination: buildPagination({
        total,
        page,
        query: { search },
        pageSize: PAGE_SIZE
      })
    })
  }
}

async function findPage({ search, page }) {
  const result = await searchHoldings({ search, page, pageSize: PAGE_SIZE })
  const lastPage = Math.max(1, result.totalPages)

  if (page <= lastPage) {
    return { ...result, page }
  }

  const lastPageResult = await searchHoldings({
    search,
    page: lastPage,
    pageSize: PAGE_SIZE
  })

  return { ...lastPageResult, page: lastPage }
}

function buildResultsSummary({ total, page }) {
  if (total === 0) {
    return null
  }

  if (total <= PAGE_SIZE) {
    return total === 1 ? 'Showing 1 result' : `Showing ${total} results`
  }

  const from = (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, total)

  return `Showing ${from} to ${to} of ${total} results`
}

function toRow({ identifier, name, endDate, location: { address } }) {
  const closed = endDate !== null && new Date(endDate) < new Date()

  return {
    cph: identifier,
    href: `/cattle/holdings/${identifier}`,
    location: [name, address.postTown, address.locality, address.postcode]
      .filter(Boolean)
      .join(', '),
    status: closed ? 'Closed' : 'Active'
  }
}
