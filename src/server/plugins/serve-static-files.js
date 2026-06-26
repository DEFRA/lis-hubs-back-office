import { createBasePathHelpersForConfig } from '@livestock/infrastructure/base-path'
import { createStaticFilesPlugin } from '@livestock/infrastructure/static-files'
import { statusCodes } from '@livestock/infrastructure/status-codes'

import { config } from '#config/config.js'

const { getAssetPaths } = createBasePathHelpersForConfig(config)

export const serveStaticFiles = createStaticFilesPlugin({
  assetPaths: getAssetPaths(),
  staticCacheTimeout: config.get('staticCacheTimeout'),
  noContentStatusCode: statusCodes.noContent
})
