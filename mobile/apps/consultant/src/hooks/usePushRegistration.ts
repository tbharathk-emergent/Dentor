import { api, registerForPush } from '@dentor/shared'
import { useEffect } from 'react'

/**
 * Registers this device for push notifications once per sign-in. Call it from the layout
 * of the signed-in area. It does nothing on web, simulators and builds without push set up.
 */
export function usePushRegistration() {
  useEffect(() => {
    void registerForPush((token, platform) => api.post('/api/devices', { token, platform }))
  }, [])
}
