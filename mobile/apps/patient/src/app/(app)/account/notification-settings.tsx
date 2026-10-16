import { api, Banner, QueryState, Screen, colors, face, switchColors, useToast } from '@dentor/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { StyleSheet, Switch, Text, View } from 'react-native'

interface Prefs { general: boolean; sound: boolean; vibrate: boolean; appointment_reminders: boolean; medicine_alerts: boolean; lab_alerts: boolean }
const ROWS: [keyof Prefs, string][] = [
  ['general', 'General Notification'], ['sound', 'Sound'], ['vibrate', 'Vibrate'],
  ['appointment_reminders', 'Appointment Reminders'], ['medicine_alerts', 'Medicine Alerts'], ['lab_alerts', 'Lab Result Alerts'],
]

/** "Notification Settings" (patient-app.fig 96:803). The app keeps every notification; these switches choose the phone alerts. */
export default function NotificationSettings() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const prefs = useQuery<Prefs>({ queryKey: ['prefs'], queryFn: () => api.get('/api/patient/account/prefs') })
  const save = useMutation({ mutationFn: (next: Prefs) => api.put<Prefs>('/api/patient/account/prefs', next) })
  return (
    <Screen testID="notification-settings-screen" title="Notification Settings" back>
      <QueryState query={prefs}>
        {(p) => (
          <>
            {ROWS.map(([key, label]) => (
              <View key={key} style={styles.row}>
                <Text style={styles.label}>{label}</Text>
                <Switch testID={`pref-${key}`} accessibilityLabel={label} value={p[key]} disabled={key !== 'general' && !p.general}
                  onValueChange={(v) => save.mutate({ ...p, [key]: v }, {
                    onSuccess: (next) => queryClient.setQueryData(['prefs'], next),
                    onError: (e) => toast.error(e),
                  })}
                  {...switchColors()} />
              </View>
            ))}
            <Banner tone="blue" icon="info" text="Your notifications always stay in the app. These switches control phone alerts, which start once the clinic's push service is connected." />
          </>
        )}
      </QueryState>
    </Screen>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52 },
  label: { ...face('semibold'), fontSize: 16, color: colors.textStrong },
})
