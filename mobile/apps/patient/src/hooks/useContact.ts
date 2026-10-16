import { useToast } from '@dentor/shared'
import { useCallback } from 'react'
import { Linking } from 'react-native'

/** Opens the dialler or the mail app; tells the user what to do when the device cannot. */
export function useContact() {
  const toast = useToast()

  const call = useCallback(
    (phone: string) => {
      Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`).catch(() =>
        toast.error(`This device cannot place calls. Dial ${phone} from a phone.`),
      )
    },
    [toast],
  )

  const email = useCallback(
    (address: string) => {
      Linking.openURL(`mailto:${address}`).catch(() => toast.error(`No mail app is set up. Write to ${address}.`))
    },
    [toast],
  )

  return { call, email }
}
