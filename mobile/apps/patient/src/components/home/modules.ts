import type { IconName } from '@dentor/shared'
import appointments from '@/assets/design/tile-appointments.png'
import cbct from '@/assets/design/tile-cbct.png'
import lab from '@/assets/design/tile-lab.png'
import payments from '@/assets/design/tile-payments.png'
import reviews from '@/assets/design/tile-reviews.png'
import scheduler from '@/assets/design/tile-scheduler.png'
import xray from '@/assets/design/tile-xray.png'
import type { AppHref } from '@/href'
import type { HomeData } from '@/types'

export interface HomeModule {
  key: string
  label: string
  /** The design's illustration; modules the design does not have use an icon. */
  image?: number | string
  icon: IconName
  href: AppHref
  /** Count shown on the tile's corner, taken from the home data. */
  badge?: (home: HomeData) => number
}

/**
 * The home grid, three to a row, in the design's order (frame "Home" 6:1887).
 *
 * FETCH brings in a record registered under another number (verified with a code to that number).
 * The design's PHARMACY tile is left out: the app has nothing behind it. Prescriptions, chat, consent
 * forms and offers are modules the design does not show; they use an icon instead of an illustration.
 */
export const HOME_MODULES: HomeModule[] = [
  { key: 'records', label: 'LAB', image: lab, icon: 'clipboard', href: { pathname: '/records', params: { tab: 'lab' } } },
  { key: 'reports', label: 'X-RAY & REPORTS', image: xray, icon: 'image', href: '/reports' },
  { key: 'cbct', label: 'CBCT', image: cbct, icon: 'layers', href: { pathname: '/reports', params: { category: 'CBCT' } } },
  { key: 'book', label: 'SCHEDULER', image: scheduler, icon: 'calendar', href: '/book' },
  { key: 'appointments', label: 'APPOINTMENTS', image: appointments, icon: 'clock', href: '/appointments' },
  { key: 'payments', label: 'PAYMENTS', image: payments, icon: 'credit-card', href: '/payments' },
  { key: 'reviews', label: 'RATINGS & REVIEWS', image: reviews, icon: 'star', href: '/reviews' },
  { key: 'prescriptions', label: 'PRESCRIPTIONS', icon: 'file-text', href: '/prescriptions' },
  { key: 'chat', label: 'CHAT', icon: 'message-circle', href: '/chat', badge: (home) => home.unread_chat },
  { key: 'consents', label: 'CONSENT FORMS', icon: 'edit-3', href: '/consents', badge: (home) => home.pending_consents },
  { key: 'fetch', label: 'FETCH', icon: 'download-cloud', href: '/fetch' },
  { key: 'offers', label: 'OFFERS', icon: 'gift', href: '/offers' },
]
