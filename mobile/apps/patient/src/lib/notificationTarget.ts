import type { AppNotification } from '@dentor/shared'
import type { AppHref } from '@/href'

const text = (value: unknown) => (typeof value === 'string' ? value : '')

/**
 * Where tapping a notification leads, from the `screen` the API put in its data.
 * Returns null for kinds the app has no screen for; the notification is then just marked read.
 */
export function notificationTarget(notification: AppNotification): AppHref | null {
  const data = notification.data ?? {}
  switch (data.screen) {
    case 'appointment': {
      const id = text(data.appointment_id)
      return id ? { pathname: '/appointment/[id]', params: { id } } : '/appointments'
    }
    case 'prescription': {
      const id = text(data.prescription_id)
      return id ? { pathname: '/prescriptions/[id]', params: { id } } : '/prescriptions'
    }
    case 'invoice': {
      const id = text(data.invoice_id)
      return id ? { pathname: '/payments/[id]', params: { id } } : '/payments'
    }
    case 'chat':
      return '/chat'
    case 'consents':
      return '/consents'
    default:
      return null
  }
}
