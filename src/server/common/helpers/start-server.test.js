import { beforeEach, describe, expect, test, vi } from 'vitest'

import { config } from '#config/config.js'
import { createServer } from '#server/server.js'
import { startServer } from './start-server.js'

vi.mock('#server/server.js')

const mocks = {
  configGet: vi.spyOn(config, 'get'),
  createServer: vi.mocked(createServer)
}

describe('startServer()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.configGet.mockReturnValue(3102)
  })

  test('it creates, starts and returns the server', async () => {
    // Arrange
    const server = {
      start: vi.fn(),
      logger: { info: vi.fn() }
    }
    mocks.createServer.mockResolvedValue(server)

    // Act
    let result, error
    try {
      result = await startServer()
    } catch (e) {
      error = e
    }

    // Assert
    expect(error).not.toBeDefined()
    expect(server.start).toHaveBeenCalled()
    expect(server.logger.info).toHaveBeenCalledWith(
      'Server started successfully'
    )
    expect(server.logger.info).toHaveBeenCalledWith(
      'Access the back office on http://localhost:3102'
    )
    expect(result).toBe(server)
  })
})
