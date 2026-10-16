import { Banner, Button, Card, ConfirmSheet, KeyValue, RateVisitSheet, QueryState, Screen, Section, Sheet, StatusBadge, T, TextField, colors, face, fmtDateTime, fmtINR, radius, space, useLocalSearchParams, useSession, useToast } from '@dentor/shared'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useAcceptProposal, useCancelRequest, useConsultRequest } from '@/clinic/consult'
import { useRefresh } from '@/hooks/useRefresh'
import { can } from '@/lib/access'
import type { StaffSession } from '@/types'

/**
 * One consultant booking for the clinic: its status as it moves (Requested, viewed, confirmed, on the way,
 * arrived, started, completed), the code the clinic reads to the consultant at the chair, the other times
 * a consultant offered, and the case that was sent.
 */
export default function ConsultRequestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const toast = useToast()
  const role = useSession<StaffSession>().data?.user?.role
  const request = useConsultRequest(id)
  const accept = useAcceptProposal()
  const cancel = useCancelRequest()
  const { refreshing, refresh } = useRefresh(request)
  const [choice, setChoice] = useState<number | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [rating, setRating] = useState(false)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState<string | undefined>()
  const frontDesk = can(role, 'front-desk')

  return (
    <Screen testID="consult-request-screen" title="Consultant Booking" back refreshing={refreshing} onRefresh={refresh}>
      <QueryState query={request}>
        {(b) => (
          <>
            <Card>
              <View style={styles.row}>
                <T variant="h3" numberOfLines={1} style={{ flex: 1 }}>{b.patient}</T>
                <StatusBadge status={b.status} />
              </View>
              <KeyValue label="Order ID" value={b.code} />
              <KeyValue label="Treatment" value={b.treatment} />
              <KeyValue label="Consultant" value={b.consultant || 'Dentor will assign one'} />
              {!!b.dentor_type_label && <KeyValue label="Appointment type" value={b.dentor_type_label} />}
              <KeyValue label="When" value={b.date ? `${b.date_label} · ${b.time_label}` : 'To be set by the consultant'} />
              {!!b.fee && <KeyValue label="Consultant fee" value={`${fmtINR(b.fee)}${b.extra_fee ? ` + ${fmtINR(b.extra_fee)}` : ''} (pay at the clinic)`} />}
              {b.status === 'Running late' && !!b.late_minutes && <Banner tone="amber" icon="clock" text={`Running about ${b.late_minutes} minutes late.`} />}
              {!!b.cancelReason && <KeyValue label="Reason" value={b.cancelReason} />}
            </Card>

            {!!b.start_code && (
              <View testID="start-code-card" style={styles.code}>
                <T variant="smallStrong" color="#ffffff">Code to start the procedure</T>
                <Text testID="start-code" style={styles.codeText}>{b.start_code.split('').join(' ')}</Text>
                <T variant="small" color="#ffffff">Read it to the consultant at the chair. Do not share it before they arrive.</T>
              </View>
            )}

            {b.status === 'Proposed' && (
              <Section title="The consultant offered other times">
                {!!b.proposal_note && <T variant="small" color={colors.textMuted}>“{b.proposal_note}”</T>}
                {b.proposals.map((p, i) => (
                  <Button key={i} testID={`proposal-${i}`} label={`${p.date_label} · ${p.time_label}`} variant="secondary" full disabled={!frontDesk} onPress={() => setChoice(i)} />
                ))}
              </Section>
            )}

            {b.status === 'Completed' && !(b as { rated_by_clinic?: number }).rated_by_clinic && (
              <Button testID="rate-consultant" label="Rate the consultant" icon="star" variant="secondary" full onPress={() => setRating(true)} />
            )}
            <RateVisitSheet bookingId={b.id} visible={rating} title={`Rate ${b.consultant}`} onClose={() => setRating(false)}
              aspects={['On time', 'Explained the treatment', 'Careful with the patient', 'Left the chair clean']} />
            {b.status === 'Completed' && (
              <Section title="Completed">
                <Card>
                  <KeyValue label="Treatment provided" value={b.treatment_provided} />
                  <KeyValue label="Notes" value={b.completion_notes} />
                  {!!b.next_visit && <KeyValue label="Next sitting" value={`${b.next_visit.date} ${b.next_visit.time}`} />}
                </Card>
              </Section>
            )}

            <Section title="Status">
              <View testID="consult-timeline" style={{ gap: space.sm }}>
                {b.timeline.map((t, i) => (
                  <View key={i} style={styles.step}>
                    <View style={[styles.dot, i === b.timeline.length - 1 && { backgroundColor: colors.header }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.stepTitle}>{t.status}</Text>
                      <T variant="tiny" color={colors.textMuted}>{[fmtDateTime(t.at), t.by, t.note].filter(Boolean).join(' · ')}</T>
                    </View>
                  </View>
                ))}
              </View>
            </Section>

            <Section title="Case sent">
              <Card>
                <KeyValue label="Provisional diagnosis" value={b.diagnosis} />
                <KeyValue label="Teeth" value={b.teeth.join(', ')} />
                <KeyValue label="Quadrants" value={b.quadrants.map((q) => (q === 'full' ? 'Full mouth' : `Q${q}`)).join(', ')} />
                <KeyValue label="Medical history" value={[...b.history, b.history_note].filter(Boolean).join(', ')} />
                <KeyValue label="Vitals" value={[b.vitals?.bp && `BP ${b.vitals.bp}`, b.vitals?.glucose && `Glucose ${b.vitals.glucose}`].filter(Boolean).join(' · ')} />
                <KeyValue label="Lab findings" value={b.lab_findings} />
                <KeyValue label="Images" value={b.images ? `${b.images} attached` : ''} />
                <KeyValue label="Notes" value={b.notes} />
              </Card>
            </Section>

            {frontDesk && !['Completed', 'Cancelled', 'Declined', 'Started'].includes(b.status) && (
              <Button testID="consult-cancel" label="Cancel booking" icon="x" variant="ghost" full onPress={() => setCancelling(true)} />
            )}

            <ConfirmSheet
              visible={choice !== null}
              onClose={() => setChoice(null)}
              loading={accept.isPending}
              title="Confirm this time?"
              message={choice !== null && b.proposals[choice] ? `${b.consultant} on ${b.proposals[choice].date_label} at ${b.proposals[choice].time_label}.` : ''}
              confirmLabel="Confirm"
              onConfirm={() =>
                choice !== null &&
                accept.mutate({ id: b.id, index: choice }, { onSuccess: () => { setChoice(null); toast.success('Confirmed with the consultant.') }, onError: (e) => { setChoice(null); toast.error(e) } })
              }
            />
            <Sheet
              testID="consult-cancel-sheet"
              visible={cancelling}
              onClose={() => setCancelling(false)}
              title="Cancel booking"
              footer={
                <Button testID="consult-cancel-confirm" label="Cancel booking" variant="danger" size="lg" full loading={cancel.isPending}
                  onPress={() => {
                    if (reason.trim().length < 3) return setReasonError('Give a reason for cancelling.')
                    cancel.mutate({ id: b.id, reason: reason.trim() }, { onSuccess: () => { setCancelling(false); toast.success('Booking cancelled. The consultant has been told.') }, onError: (e) => toast.error(e) })
                  }}
                />
              }
            >
              <TextField testID="consult-cancel-reason" label="Reason" required value={reason} onChangeText={setReason} error={reasonError} maxLength={200} />
            </Sheet>
          </>
        )}
      </QueryState>
    </Screen>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  code: { alignItems: 'center', gap: space.xs, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.header },
  codeText: { ...face('bold'), fontSize: 34, lineHeight: 42, letterSpacing: 4, color: '#fdc500' },
  step: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 4, backgroundColor: colors.border },
  stepTitle: { ...face('semibold'), fontSize: 14, color: colors.textStrong },
})
