// Holdings copied from the fake service's GET /krds/api/v2/holdings, standing in for that API until it is integrated.
import holdingFixtures from './holdings-fixtures.json' with { type: 'json' }

export const PAGE_SIZE = 25

/**
 * @typedef {object} HoldingAddress
 * @property {string | null} addressLine1
 * @property {string | null} addressLine2
 * @property {string | null} postTown
 * @property {string | null} locality
 * @property {string | null} postcode
 */

/**
 * @typedef {object} HoldingDetail
 * @property {string} identifier
 * @property {string | null} name
 * @property {string | null} endDate
 * @property {{ address: HoldingAddress }} location
 * @property {Array<{ mark: string }>} marks
 */

/**
 * @typedef {object} PaginatedResultOfHoldingDetail
 * @property {Array<HoldingDetail>} values
 * @property {number} count
 * @property {number} totalCount
 * @property {number} page
 * @property {number} pageSize
 * @property {number} totalPages
 * @property {boolean} hasNextPage
 * @property {boolean} hasPreviousPage
 * @property {null} nextCursor
 */

/**
 * @param {object} options
 * @param {string} [options.search]
 * @param {number} [options.page]
 * @param {number} [options.pageSize]
 * @returns {Promise<PaginatedResultOfHoldingDetail>}
 */
export async function searchHoldings({
  search,
  page = 1,
  pageSize = PAGE_SIZE
}) {
  const term = (search ?? '').trim()

  // Deliberately differs from the API, which returns everything for a blank
  // search: the page shows nothing until a term is entered.
  const matches = term
    ? holdingFixtures
        .filter((holding) => matchesTerm(holding, term))
        .sort((first, second) =>
          first.identifier.localeCompare(second.identifier)
        )
    : []
  const start = (page - 1) * pageSize
  const values = matches.slice(start, start + pageSize)
  const totalPages = Math.ceil(matches.length / pageSize)

  return {
    values,
    count: values.length,
    totalCount: matches.length,
    page,
    pageSize,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
    nextCursor: null
  }
}

/**
 * @param {HoldingDetail} holding
 * @param {string} term
 * @returns {boolean}
 */
function matchesTerm(holding, term) {
  const lowerTerm = term.toLowerCase()
  const compactTerm = removeNonAlphanumeric(lowerTerm)
  const { address } = holding.location
  const fields = [
    holding.identifier,
    holding.name,
    address.addressLine1,
    address.addressLine2,
    address.postTown,
    address.locality,
    address.postcode,
    ...holding.marks.map(({ mark }) => mark)
  ]

  return fields.some((field) => {
    if (!field) {
      return false
    }

    const lowerField = field.toLowerCase()

    return (
      lowerField.includes(lowerTerm) ||
      (compactTerm !== '' &&
        removeNonAlphanumeric(lowerField).includes(compactTerm))
    )
  })
}

function removeNonAlphanumeric(value) {
  return value.replaceAll(/[^\p{L}\p{N}]/gu, '')
}
