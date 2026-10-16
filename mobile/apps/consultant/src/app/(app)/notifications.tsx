import { NotificationsScreen } from '@dentor/shared'
import { useRouter } from '@/nav'

export default function Notifications() {
  const router = useRouter()
  return (
    <NotificationsScreen
      basePath="/api"
      onOpen={(n) => {
        const appointmentId = n.data?.appointment_id
        if (typeof appointmentId === 'string' && appointmentId) router.push({ pathname: '/appointments/[id]', params: { id: appointmentId } })
      }}
    />
  )
}
