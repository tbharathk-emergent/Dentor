import { NotificationsScreen } from '@dentor/shared'
import { PATIENT_API } from '@/endpoints'
import { notificationTarget } from '@/lib/notificationTarget'
import { useRouter } from '@/nav'

export default function Notifications() {
  const router = useRouter()
  return (
    <NotificationsScreen
      basePath={PATIENT_API}
      grouped
      onOpen={(notification) => {
        const target = notificationTarget(notification)
        if (target) router.push(target)
      }}
    />
  )
}
