import { getHubAuthSession, hasRole } from '@defra/lis-hubs-infra-access/auth'

import { getActionsToComplete } from '#server/services/actions-to-complete.js'

const afternoonStartsAt = 12
const eveningStartsAt = 18

export const homeController = {
  async handler(request, h) {
    const authenticatedUser = getHubAuthSession(request)

    if (!authenticatedUser) {
      const returnUrl = encodeURIComponent(
        request.url.pathname + request.url.search
      )
      return h.redirect(`/auth/login?returnUrl=${returnUrl}`)
    }

    return h.view('home/dashboard', {
      pageTitle: 'Dashboard',
      authenticatedUser,
      greeting: getGreeting(),
      actionsToComplete: await getActionsToComplete({
        user: authenticatedUser
      }),
      canApprovePassport: hasRole(authenticatedUser, {
        role: 'lis-role-passport-approver'
      }),
      logoutUrl: '/auth/logout'
    })
  }
}

/**
 * @param {Date} date
 * @returns {string}
 */
export function getGreeting(date = new Date()) {
  const hour = date.getHours()

  if (hour < afternoonStartsAt) {
    return 'Good morning'
  }

  if (hour < eveningStartsAt) {
    return 'Good afternoon'
  }

  return 'Good evening'
}
