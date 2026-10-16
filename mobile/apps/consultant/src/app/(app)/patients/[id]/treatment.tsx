import { Banner, Button, errorMessage, QueryState, Screen, todayISO, useToast } from '@dentor/shared'
import { useState } from 'react'
import { View } from 'react-native'
import { AllergyBanner } from '@/components/AllergyBanner'
import { TreatmentForm } from '@/components/TreatmentForm'
import { useCatalog } from '@/hooks/useCatalog'
import { useLeave } from '@/hooks/useLeave'
import { usePatient } from '@/hooks/usePatients'
import { useAddTreatment } from '@/hooks/useTreatments'
import { ageGender, dotJoin } from '@/lib/people'
import { emptyTreatment, toTreatmentPayload, validateTreatment, type TreatmentDraft } from '@/lib/treatmentForm'
import { useLocalSearchParams } from '@/nav'

export default function AddTreatmentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const leave = useLeave()
  const toast = useToast()
  const today = todayISO()

  const patient = usePatient(id)
  const catalog = useCatalog()
  const add = useAddTreatment(id)
  const [draft, setDraft] = useState<TreatmentDraft>(() => emptyTreatment(today))
  // Field messages appear after the first attempt to save, then follow the edits.
  const [checked, setChecked] = useState(false)
  const errors = validateTreatment(draft)

  const submit = () => {
    setChecked(true)
    const problems = Object.values(errors)
    if (problems.length > 0) {
      // Name the first problem: its field may be scrolled out of view.
      toast.error(problems.length > 1 ? `${problems[0]} ${problems.length - 1} more marked in red.` : problems[0])
      return
    }
    add.mutate(toTreatmentPayload(draft), {
      onSuccess: (saved) => {
        toast.success(`${saved.name} added to the treatment plan`)
        leave()
      },
    })
  }

  const p = patient.data?.patient
  return (
    <Screen
      testID="screen-treatment"
      title="Add treatment"
      subtitle={p ? dotJoin(p.name, p.code, ageGender(p)) : undefined}
      back
      footer={
        p ? (
          <>
            {/* The API's own explanation (for example, a signed consent is required first), shown as is. */}
            {add.isError && (
              <View testID="treatment-error">
                <Banner tone="red" icon="alert-circle" text={errorMessage(add.error)} />
              </View>
            )}
            <Button testID="treatment-submit" label="Add treatment" icon="plus" size="lg" full loading={add.isPending} onPress={submit} />
          </>
        ) : undefined
      }
    >
      <QueryState query={patient}>
        {(detail) => (
          <>
            <AllergyBanner allergy={detail.patient.allergy} />
            <TreatmentForm
              draft={draft}
              onChange={(patch) => {
                setDraft((d) => ({ ...d, ...patch }))
                // The API's message described the previous attempt.
                if (add.isError) add.reset()
              }}
              errors={checked ? errors : {}}
              treatments={catalog.data?.treatments ?? []}
              today={today}
            />
          </>
        )}
      </QueryState>
    </Screen>
  )
}
