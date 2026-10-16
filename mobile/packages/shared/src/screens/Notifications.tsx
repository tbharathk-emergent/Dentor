import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { api } from '../api'
import { Feather } from '../ui/icons'
import { dayLabel, timeAgo } from '../format'
import { colors, font, radius, space, face } from '../theme'
import { useToast } from '../ui/feedback'
import { IconTile, Screen } from '../ui/layout'
import { Button, type IconName } from '../ui/primitives'
import { EmptyState, QueryState } from '../ui/states'

export interface AppNotification {
  id: string
  title: string
  body: string
  kind: string
  data: Record<string, any>
  read: boolean
  created_at: string
}

// One icon per kind of notification the API sends: the patient kinds, and the staff kinds the
// web app's notification bell also has (appointment, review, patient, chat).
const ICONS: Record<string, IconName> = {
  appointment: 'calendar', prescription: 'file-text', invoice: 'credit-card', payment: 'check-circle',
  chat: 'message-circle', consent: 'edit-3', review: 'star', patient: 'user-plus', general: 'bell',
}

/** `basePath` is "/api" for staff, owner and consultant logins and "/api/patient" for patients. */
export const notificationsKey = (basePath: string) => ['notifications', basePath]

export function useNotifications(basePath: string) {
  return useQuery<{ items: AppNotification[]; unread: number }>({
    queryKey: notificationsKey(basePath),
    queryFn: () => api.get(`${basePath}/notifications`),
    refetchInterval: 60_000,
  })
}

/** Notifications under one day heading, newest day first (the API sends newest first). */
function byDay(items: AppNotification[]): { label: string; items: AppNotification[] }[] {
  const groups: { label: string; items: AppNotification[] }[] = []
  for (const item of items) {
    const label = dayLabel(item.created_at)
    const last = groups[groups.length - 1]
    if (last?.label === label) last.items.push(item)
    else groups.push({ label, items: [item] })
  }
  return groups
}

/**
 * `grouped` lists notifications under "Today", "Yesterday" and date headings with "Mark all"
 * beside the first heading, as the patient app's design has it; otherwise one list with the
 * button pinned to the foot of the screen.
 */
export function NotificationsScreen({ basePath, onOpen, grouped }: { basePath: string; onOpen?: (n: AppNotification) => void; grouped?: boolean }) {
  const toast = useToast()
  const qc = useQueryClient()
  const query = useNotifications(basePath)
  const markRead = useMutation({
    mutationFn: (ids?: string[]) => api.post(`${basePath}/notifications/read`, ids ? { ids } : {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationsKey(basePath) }),
    onError: (e) => toast.error(e),
  })

  // Grouped (the patient design, frame "Notification" 95:299): round icons, no card, heading font.
  const row = (n: AppNotification) => grouped ? (
    <Pressable
      key={n.id}
      testID="notification"
      accessibilityRole="button"
      onPress={() => {
        if (!n.read) markRead.mutate([n.id])
        onOpen?.(n)
      }}
      style={({ pressed }) => [styles.flat, !n.read && { backgroundColor: colors.brand50 }, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.round}><Feather name={ICONS[n.kind] ?? 'bell'} size={20} color="#ffffff" /></View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text numberOfLines={1} style={[{ fontSize: 17, lineHeight: 21, color: colors.textStrong }, face('medium', true)]}>{n.title}</Text>
        <Text numberOfLines={3} style={[{ fontSize: 13, lineHeight: 16, color: colors.text }, face('light', true)]}>{n.body}</Text>
      </View>
      <Text style={[{ fontSize: 12, lineHeight: 16, color: colors.textStrong }, face('light', true)]}>{timeAgo(n.created_at)}</Text>
    </Pressable>
  ) : (
    <Pressable
      key={n.id}
      testID="notification"
      accessibilityRole="button"
      onPress={() => {
        if (!n.read) markRead.mutate([n.id])
        onOpen?.(n)
      }}
      style={({ pressed }) => [styles.item, !n.read && styles.unread, pressed && { opacity: 0.85 }]}
    >
      <IconTile icon={ICONS[n.kind] ?? 'bell'} tone={n.read ? 'slate' : 'brand'} size={40} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text numberOfLines={1} style={[font.bodyStrong, { color: colors.text }]}>{n.title}</Text>
        <Text numberOfLines={3} style={[font.small, { color: colors.textMuted }]}>{n.body}</Text>
        <Text style={[font.tiny, { color: colors.textFaint, ...face('medium') }]}>{timeAgo(n.created_at)}</Text>
      </View>
      {!n.read && <View style={styles.dot} />}
    </Pressable>
  )

  return (
    <Screen
      testID="notifications-screen"
      title="Notifications"
      back
      padded
      refreshing={query.isRefetching}
      onRefresh={() => query.refetch()}
      footer={
        !grouped && query.data?.unread ? (
          <Button testID="mark-all-read" label={`Mark all ${query.data.unread} as read`} variant="secondary" full loading={markRead.isPending} onPress={() => markRead.mutate(undefined)} />
        ) : undefined
      }
    >
      <QueryState query={query}>
        {(data) =>
          data.items.length === 0 ? (
            <EmptyState icon="bell-off" title="You're all caught up" message="Updates about appointments, bills and messages appear here." />
          ) : (
            <View style={{ gap: space.sm }}>
              {(grouped ? byDay(data.items) : [{ label: '', items: data.items }]).map((group, index) => (
                <View key={group.label || 'all'} style={{ gap: space.sm }}>
                  {grouped && (
                    <View style={styles.day}>
                      <View style={styles.dayPill}>
                        <Text testID="notifications-day" accessibilityRole="header" style={[{ fontSize: 17, lineHeight: 21, color: '#ffffff' }, face('regular', true)]}>{group.label}</Text>
                      </View>
                      <View style={{ flex: 1 }} />
                      {index === 0 && data.unread > 0 && (
                        <Pressable testID="mark-all-read" accessibilityRole="button" hitSlop={10} disabled={markRead.isPending} onPress={() => markRead.mutate(undefined)}>
                          <Text style={[{ fontSize: 14, lineHeight: 18, color: colors.brand700 }, face('semibold', true)]}>Mark all</Text>
                        </Pressable>
                      )}
                    </View>
                  )}
                  {group.items.map(row)}
                </View>
              ))}
            </View>
          )
        }
      </QueryState>
    </Screen>
  )
}

const styles = StyleSheet.create({
  day: { flexDirection: 'row', alignItems: 'center', minHeight: 28, marginTop: space.xs },
  dayPill: { minHeight: 33, paddingHorizontal: 18, borderRadius: 23, backgroundColor: colors.brand700, justifyContent: 'center' },
  flat: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.sm, paddingHorizontal: space.sm, borderRadius: radius.md },
  round: { width: 45, height: 45, borderRadius: 23, backgroundColor: colors.brand700, alignItems: 'center', justifyContent: 'center' },
  item: { flexDirection: 'row', gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  unread: { borderColor: colors.brand200, backgroundColor: colors.brand50 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.brand600, marginTop: 6 },
})
