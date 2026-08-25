import { hasPermission, PERMISSIONS } from '@defra/lis-hubs-infra-access/auth'

import { getActionsToComplete } from '#server/services/actions-to-complete.js'
import { requireBackOfficeAccess } from '#server/common/helpers/auth/require-back-office-access.js'

const afternoonStartsAt = 12
const eveningStartsAt = 18

export const homeController = {
  async handler(request, h) {
    const denied = requireBackOfficeAccess(request, h)

    if (denied) {
      return denied
    }

    const authenticatedUser = request.app.hubAuth

    return h.view('home/dashboard', {
      pageTitle: 'Dashboard',
      authenticatedUser,
      greeting: getGreeting(),
      actionsToComplete: await getActionsToComplete({
        user: authenticatedUser
      }),
      canApprovePassport: hasPermission(authenticatedUser, {
        permission: PERMISSIONS.passportApprover
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
