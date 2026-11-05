import { createAssetPathHelpers } from '@defra/lis-infra-ui-services/asset-path'
import { createStaticFilesPlugin } from '@defra/lis-infra-ui-services/static-files'
import { statusCodes } from '@defra/lis-infra-ui-services/status-codes'

import { config } from '#config/config.js'

const { getAssetPaths } = createAssetPathHelpers({
  assetPath: config.get('assetPath')
})

export const serveStaticFiles = createStaticFilesPlugin({
  assetPaths: getAssetPaths(),
  staticCacheTimeout: config.get('staticCacheTimeout'),
  noContentStatusCode: statusCodes.noContent
})
