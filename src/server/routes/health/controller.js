/** @import { Request, ResponseObject, ResponseToolkit } from '@hapi/hapi' */

import { statusCodes } from '@defra/lis-infra-ui-services/status-codes'

export const healthController = {
  /**
   * Responds with a success message for health checks.
   * @param {Request} _request - The Hapi request
   * @param {ResponseToolkit} h - The Hapi response toolkit
   * @returns {ResponseObject} The success response
   */
  handler(_request, h) {
    return h.response({ message: 'success' }).code(statusCodes.ok)
  }
}
