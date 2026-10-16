import { Banner, Card, KeyValue, Section, StatusBadge, T, colors, fmtDate, space } from '@dentor/shared'
import { StyleSheet, View } from 'react-native'
import { MedicineTable } from '@/components/prescriptions/MedicineTable'
import type { Prescription } from '@/types'

/** A full prescription: who and when, the diagnosis, the medicines, advice and the follow-up date. */
export function PrescriptionDetails({ prescription }: { prescription: Prescription }) {
  const clinic = prescription.clinic
  return (
    <>
      <Card style={styles.card}>
        <View style={styles.head}>
          <View style={styles.title}>
            <T variant="h2" testID="prescription-doctor">{prescription.doctor}</T>
            <T variant="small" color={colors.textMuted}>
              {prescription.code} · <T variant="small" color={colors.textMuted} testID="prescription-date">{fmtDate(prescription.date)}</T>
            </T>
          </View>
          <StatusBadge status={prescription.status} />
        </View>
        <View>
          <KeyValue label="Diagnosis" value={prescription.diagnosis} strong />
          <KeyValue label="Complaint" value={prescription.complaint} />
          {!!prescription.note && <KeyValue label="Clinical note" value={prescription.note} />}
        </View>
      </Card>

      {!!prescription.allergy && <Banner tone="amber" icon="alert-triangle" text={`Allergy on record: ${prescription.allergy}`} />}

      <Section title="Medicines">
        <Card>
          {prescription.meds.length ? (
            <MedicineTable meds={prescription.meds} />
          ) : (
            <T variant="small" color={colors.textMuted}>No medicines were prescribed.</T>
          )}
        </Card>
      </Section>

      {!!prescription.advice && (
        <Section title="Advice">
          <Card>
            <T testID="prescription-advice">{prescription.advice}</T>
          </Card>
        </Section>
      )}

      <Card>
        <KeyValue label="Follow-up" value={prescription.followUp ? fmtDate(prescription.followUp) : 'Not needed'} strong />
        {clinic && <KeyValue label="Clinic" value={clinic.name} />}
        {!!clinic?.phone && <KeyValue label="Phone" value={clinic.phone} />}
      </Card>
    </>
  )
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  title: { flex: 1, minWidth: 0, gap: 2 },
})
