import { Banner, Button, Card, KeyValue, QueryState, Screen, T, colors, fmtDate, space, useLocalSearchParams } from '@dentor/shared'
import { Share, View } from 'react-native'
import { useCertificate, type Certificate } from '@/clinic/clinical'

const LABELS: Record<string, string> = {
  marital_status: 'Marital status', examination: 'Examination', findings: 'Findings', fitness: 'Fitness', remarks: 'Remarks',
  specialist: 'Referred to', reason: 'Reason for referral', investigations: 'Investigations',
}

const asText = (c: Certificate) =>
  [`${c.type.toUpperCase()} CERTIFICATE`, c.clinic?.name, `${c.code} · ${fmtDate(c.date)}`, '',
    `Patient: ${c.patient} (${c.patientCode})${c.age ? `, ${c.age} yrs` : ''}${c.gender ? `, ${c.gender}` : ''}`,
    ...Object.entries(c.details).map(([k, v]) => `${LABELS[k] ?? k}: ${v}`), '', `${c.doctor}`].filter((x) => x !== undefined).join('\n')

/** The certificate preview (dentor.fig 321, 324) with share. */
export default function CertificateView() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const cert = useCertificate(id)
  return (
    <Screen testID="certificate-screen" title="Certificate" back>
      <QueryState query={cert}>
        {(c) => (
          <>
            <Card>
              <View style={{ alignItems: 'center', gap: 2 }}>
                <T variant="h3">{c.clinic?.name}</T>
                <T variant="tiny" color={colors.textMuted}>{[c.clinic?.address, c.clinic?.city, c.clinic?.phone].filter(Boolean).join(' · ')}</T>
                <T variant="bodyStrong" style={{ marginTop: space.sm }}>{c.type.toUpperCase()} CERTIFICATE</T>
              </View>
              <KeyValue label="Certificate no." value={c.code} />
              <KeyValue label="Date" value={fmtDate(c.date)} />
              <KeyValue label="Patient" value={`${c.patient} (${c.patientCode})`} />
              <KeyValue label="Age, sex" value={[c.age ? `${c.age} yrs` : '', c.gender].filter(Boolean).join(', ')} />
              <KeyValue label="Address" value={c.address} />
              {Object.entries(c.details).map(([k, v]) => <KeyValue key={k} label={LABELS[k] ?? k} value={v} />)}
              <KeyValue label="Doctor" value={c.doctor} />
            </Card>
            <Banner tone="blue" icon="info" text="Printing on the clinic's letterhead is not part of this version: share it, or print from the reception web app." />
            <Button testID="certificate-share" label="Share" icon="share-2" variant="secondary" full onPress={() => Share.share({ message: asText(c) }).catch(() => undefined)} />
          </>
        )}
      </QueryState>
    </Screen>
  )
}
