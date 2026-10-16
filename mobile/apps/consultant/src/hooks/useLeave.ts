import { useCallback } from 'react'
import { useRouter } from '@/nav'

/** Leaves the current screen: back when there is somewhere to go back to, otherwise home. */
export function useLeave() {
  const router = useRouter()
  return useCallback(() => {
    if (router.canGoBack()) router.back()
    else router.replace('/')
  }, [router])
}
