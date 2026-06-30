import { statusCodes } from '@livestock/ui-services/status-codes'

export const healthController = {
  handler(_request, h) {
    return h.response({ message: 'success' }).code(statusCodes.ok)
  }
}
