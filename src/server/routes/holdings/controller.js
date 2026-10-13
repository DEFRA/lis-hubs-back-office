import Joi from 'joi'

import { PAGE_SIZE, searchHoldings } from '#server/services/holdings.js'

const maximumSearchLength = 100

const badRequest = 400

const noMatches = { items: [], total_count: 0, total_pages: 0, page: 1 }

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
      items,
      total_count: total,
      total_pages: totalPages,
      page
    } = searched
      ? await findPage({ search, page: request.query.page })
      : noMatches

    const pageCount = Math.max(1, totalPages)

    return h.view('holdings/holdings', {
      pageTitle:
        pageCount > 1
          ? `Page ${page} of ${pageCount} - Find a holding`
          : 'Find a holding',
      search,
      searched,
      results: items.map(toRow),
      total,
      pagination:
        total === 0
          ? null
          : {
              currentPage: page,
              totalPages: pageCount,
              totalItems: total,
              itemsPerPage: PAGE_SIZE
            }
    })
  }
}

async function findPage({ search, page }) {
  let result
  try {
    result = await searchHoldings({ search, page, pageSize: PAGE_SIZE })
  } catch (error) {
    // The BE4FE rejects terms it cannot search on (e.g. punctuation only);
    // for the user that is simply a search with no matches.
    if (error.statusCode === badRequest) {
      return noMatches
    }
    throw error
  }

  if (result.total_count === 0) {
    return { ...result, page: 1 }
  }

  const lastPage = Math.max(1, result.total_pages)

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

function toRow({ cph, address }) {
  return {
    cph,
    href: `/cattle/holdings/${cph}`,
    location: (address ?? []).filter(Boolean).join(', '),
    // TODO: the BE4FE holding response carries no status or end date yet, so
    // every holding shows as Active until it does.
    status: 'Active'
  }
}
