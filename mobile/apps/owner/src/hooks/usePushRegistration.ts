import { api, registerForPush } from '@dentor/shared'
import { useEffect } from 'react'

/**
 * Registers this device for push notifications once per signed-in session. Call it from the
 * first screen of the signed-in area. It does nothing on web, simulators or without permission.
 */
export function usePushRegistration() {
  useEffect(() => {
    void registerForPush((token, platform) => api.post('/api/devices', { token, platform }))
  }, [])
}
