import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { StyleSheet, Switch, Text, View } from 'react-native'
import { api, errorMessage } from '../../api'
import { fmtDateTime } from '../../format'
import { colors, face, space, switchColors } from '../../theme'
import { useToast } from '../../ui/feedback'
import { Screen } from '../../ui/layout'
import { Banner, Button, Chip, Row, T, TextField } from '../../ui/primitives'
import { QueryState } from '../../ui/states'

interface Prefs { mute: boolean; sound: boolean; vibrate: boolean; muted_until: string; sleep: { enabled: boolean; start: string; end: string } }

/** "notification setting" (dentor.fig 286–289, 429): mute, sound, vibrate, silence for a while, sleep hours. */
export function NotificationSettingsScreen() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const prefs = useQuery<Prefs>({ queryKey: ['engage', 'prefs'], queryFn: () => api.get('/api/engage/prefs') })
  const [draft, setDraft] = useState<Prefs | null>(null)
  const [minutes, setMinutes] = useState(0)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { if (prefs.data) setDraft(prefs.data) }, [prefs.data])
  const save = useMutation({ mutationFn: (body: object) => api.put<Prefs>('/api/engage/prefs', body) })
  // the design's messages for the mute switch (dentor.fig "text" 289); other changes just say they were saved
  const submit = (next: Prefs, muteMinutes = minutes) => {
    setError(null)
    const muteChanged = !!draft && next.mute !== draft.mute
    save.mutate({ mute: next.mute, sound: next.sound, vibrate: next.vibrate, muted_minutes: muteMinutes, sleep: next.sleep }, {
      onSuccess: (p) => {
        queryClient.setQueryData(['engage', 'prefs'], p)
        setDraft(p)
        toast.success(muteChanged ? (p.mute ? 'Notification Muted Successfully' : 'Notification Unmuted Successfully') : 'Saved.')
      },
      onError: (e) => setError(errorMessage(e)),
    })
  }
  const row = (label: string, value: boolean, onChange: (v: boolean) => void, testID: string) => (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Switch testID={testID} accessibilityLabel={label} value={value} onValueChange={onChange} {...switchColors()} />
    </View>
  )
  return (
    <Screen testID="notification-settings-screen" title="Notification setting" back>
      <QueryState query={prefs}>
        {() => draft && (
          <>
            {row('Mute Notification', draft.mute, (v) => submit({ ...draft, mute: v }, 0), 'pref-mute')}
            {row('Sound', draft.sound, (v) => submit({ ...draft, sound: v }), 'pref-sound')}
            {row('Vibrate', draft.vibrate, (v) => submit({ ...draft, vibrate: v }), 'pref-vibrate')}
            <T variant="smallStrong">Silence for</T>
            <Row gap={space.sm}>
              {[30, 60, 90].map((m) => <Chip key={m} testID={`silence-${m}`} label={`${m} mins`} selected={minutes === m} onPress={() => { setMinutes(m); submit(draft, m) }} />)}
            </Row>
            {!!draft.muted_until && draft.muted_until > new Date().toISOString() && <T variant="small" color={colors.textMuted}>Silenced till {fmtDateTime(draft.muted_until)}</T>}
            {row('Sleep Mode', draft.sleep.enabled, (v) => setDraft({ ...draft, sleep: { ...draft.sleep, enabled: v } }), 'pref-sleep')}
            {draft.sleep.enabled && (
              <>
                <Row gap={space.sm}>
                  <View style={{ flex: 1 }}><TextField testID="sleep-start" label="Start Time" value={draft.sleep.start} onChangeText={(t) => setDraft({ ...draft, sleep: { ...draft.sleep, start: t } })} maxLength={5} /></View>
                  <View style={{ flex: 1 }}><TextField testID="sleep-end" label="End Time" value={draft.sleep.end} onChangeText={(t) => setDraft({ ...draft, sleep: { ...draft.sleep, end: t } })} maxLength={5} /></View>
                </Row>
              </>
            )}
            <Button testID="prefs-save" label="OK" full loading={save.isPending} onPress={() => submit(draft)} />
            {!!error && <Banner tone="red" icon="alert-circle" text={error} />}
            <Banner tone="blue" icon="info" text="Notifications are always kept in the app. These settings hold back phone alerts, which start once Dentor's push service is connected." />
          </>
        )}
      </QueryState>
    </Screen>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 },
  label: { ...face('semibold'), fontSize: 16, color: colors.textStrong },
})
