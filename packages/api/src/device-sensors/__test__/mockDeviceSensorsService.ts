import type { Mock } from 'vitest'
import type { DeviceSensorsService } from '../device-sensors.service.js'
import { vi } from 'vitest'

export interface MockDeviceSensorsService {
  findForDevice: Mock
  syncFromHeader: Mock
}

export function createMockDeviceSensorsService(): MockDeviceSensorsService {
  return {
    findForDevice: vi.fn(),
    syncFromHeader: vi.fn(),
  }
}

/** Default behaviour after `vi.resetAllMocks()`: no readings, sync resolves without doing anything observable. */
export function primeMockDeviceSensorsService(mock: MockDeviceSensorsService) {
  mock.findForDevice.mockResolvedValue([])
  mock.syncFromHeader.mockResolvedValue(undefined)
}

/** A Device Sensors service that finds no readings, for a collaborator that only passes it through. */
export function createNoSensorsService(): DeviceSensorsService {
  const mock = createMockDeviceSensorsService()
  primeMockDeviceSensorsService(mock)
  return mock as unknown as DeviceSensorsService
}
