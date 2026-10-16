import { Banner, Button, ConfirmSheet, QueryState, Screen, todayISO, useToast } from '@dentor/shared'
import { useState } from 'react'
import { PrescriptionForm } from '@/components/PrescriptionForm'
import { PrescriptionSummary } from '@/components/PrescriptionSummary'
import { useCatalog } from '@/hooks/useCatalog'
import { useLeave } from '@/hooks/useLeave'
import { usePatient } from '@/hooks/usePatients'
import { usePrescriptionDraft } from '@/hooks/usePrescriptionDraft'
import { useWritePrescription } from '@/hooks/usePrescriptions'
import { ageGender, dotJoin } from '@/lib/people'
import { toPayload } from '@/lib/prescriptionForm'
import { useLocalSearchParams, useRouter } from '@/nav'

export default function PrescribeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const leave = useLeave()
  const toast = useToast()
  const today = todayISO()

  const patient = usePatient(id)
  const catalog = useCatalog()
  const form = usePrescriptionDraft(today)
  const write = useWritePrescription(id)
  const [step, setStep] = useState<'edit' | 'review'>('edit')
  const [discarding, setDiscarding] = useState(false)

  const review = () => {
    const problem = form.validate()
    if (problem) toast.error(problem)
    else setStep('review')
  }
  const issue = () =>
    write.mutate(toPayload(form.draft), {
      onSuccess: (rx) => {
        toast.success(`Prescription ${rx.code} issued`)
        // Replace, so "back" from the prescription returns to the patient, not to this form.
        router.replace({ pathname: '/prescriptions/[id]', params: { id: rx.id, patientId: id } })
      },
      onError: (err) => toast.error(err),
    })
  const back = () => {
    if (step === 'review') setStep('edit')
    else if (form.dirty) setDiscarding(true)
    else leave()
  }

  const p = patient.data?.patient
  return (
    <Screen
      // A new key per step puts the review (and the form, on the way back) at the top of the page.
      key={step}
      testID="screen-prescribe"
      title={step === 'edit' ? 'Write prescription' : 'Review prescription'}
      subtitle={p ? dotJoin(p.name, p.code, ageGender(p)) : undefined}
      back
      onBack={back}
      footer={
        !p ? undefined : step === 'edit' ? (
          <Button testID="rx-review" label="Review prescription" icon="arrow-right" size="lg" full onPress={review} />
        ) : (
          <>
            <Button testID="rx-issue" label="Issue prescription" icon="check" size="lg" full loading={write.isPending} onPress={issue} />
            <Button testID="rx-edit" label="Back to editing" variant="ghost" full disabled={write.isPending} onPress={() => setStep('edit')} />
          </>
        )
      }
    >
      <QueryState query={patient}>
        {(detail) =>
          step === 'edit' ? (
            <PrescriptionForm form={form} allergy={detail.patient.allergy} medicines={catalog.data?.medicines ?? []} today={today} />
          ) : (
            <>
              <Banner tone="blue" icon="eye" text="Check every line. Once issued, the prescription is signed in your name and the patient is notified." />
              <PrescriptionSummary content={toPayload(form.draft)} allergy={detail.patient.allergy} />
            </>
          )
        }
      </QueryState>
      <ConfirmSheet
        visible={discarding}
        onClose={() => setDiscarding(false)}
        onConfirm={() => {
          setDiscarding(false)
          leave()
        }}
        title="Discard this prescription?"
        message="What you have written so far will be lost."
        confirmLabel="Discard"
        danger
      />
    </Screen>
  )
}
