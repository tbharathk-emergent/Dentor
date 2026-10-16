import { api, registerForPush } from '@dentor/shared'
import { useEffect } from 'react'
import { PATIENT_API } from '@/endpoints'

/**
 * Registers this device for push notifications, once per mount of the caller. Used by the
 * home screen, which mounts once each time a patient enters the signed-in area.
 * Does nothing on web, in simulators or without notification permission; the in-app
 * notification list works regardless.
 */
export function usePushRegistration() {
  useEffect(() => {
    void registerForPush((token, platform) => api.post(`${PATIENT_API}/devices`, { token, platform }))
  }, [])
}
