import { Card, colors, Divider, fmtDate, KeyValue, space, T, face } from '@dentor/shared'
import { Fragment } from 'react'
import { View } from 'react-native'
import { FREQUENCY_MEANING, medicineLine } from '@/lib/prescriptionForm'
import type { Medicine } from '@/types'
import { AllergyBanner } from './AllergyBanner'

export interface PrescriptionContent {
  diagnosis: string
  complaint?: string
  note?: string
  meds: Pick<Medicine, 'drug' | 'dose' | 'freq' | 'days' | 'unit' | 'instruction'>[]
  advice?: string
  followUp?: string
}

/** A prescription laid out for reading: used for the review step and for issued prescriptions. */
export function PrescriptionSummary({ content, allergy }: { content: PrescriptionContent; allergy?: string | null }) {
  return (
    <View style={{ gap: space.lg }}>
      <AllergyBanner allergy={allergy} />
      <Card style={{ gap: space.xs }}>
        <T variant="tiny" color={colors.textMuted}>DIAGNOSIS</T>
        <T variant="h3" testID="rx-diagnosis">{content.diagnosis}</T>
        {!!content.complaint && <KeyValue label="Complaint" value={content.complaint} />}
        {!!content.note && (
          <View style={{ gap: 2, marginTop: space.sm }}>
            <T variant="tiny" color={colors.textMuted}>CLINICAL NOTE</T>
            <T variant="small">{content.note}</T>
          </View>
        )}
      </Card>

      <Card style={{ gap: space.md }}>
        <T variant="tiny" color={colors.textMuted}>{`MEDICINES (${content.meds.length})`}</T>
        {content.meds.map((m, i) => (
          <Fragment key={`${m.drug}-${i}`}>
            {i > 0 && <Divider />}
            <View testID={`rx-med-${i}`} style={{ gap: 2 }}>
              <T variant="bodyStrong">{`${i + 1}. ${m.drug}`}</T>
              <T variant="small" color={colors.textMuted}>{medicineLine(m)}</T>
              {!!FREQUENCY_MEANING[m.freq] && (
                <T variant="tiny" color={colors.textFaint} style={{ ...face('medium') }}>{`${m.freq} = ${FREQUENCY_MEANING[m.freq]}`}</T>
              )}
            </View>
          </Fragment>
        ))}
      </Card>

      {(!!content.advice || !!content.followUp) && (
        <Card style={{ gap: space.xs }}>
          {!!content.advice && (
            <View style={{ gap: 2 }}>
              <T variant="tiny" color={colors.textMuted}>ADVICE</T>
              <T variant="small">{content.advice}</T>
            </View>
          )}
          {!!content.followUp && <KeyValue label="Follow-up" value={fmtDate(content.followUp)} strong />}
        </Card>
      )}
    </View>
  )
}
