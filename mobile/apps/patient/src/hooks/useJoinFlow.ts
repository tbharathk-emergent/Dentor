import { ApiError, useSession, useToast } from '@dentor/shared'
import { useEffect, useState } from 'react'
import { useJoinClinic } from '@/hooks/useProfiles'
import { forgetSignupDetails, recallSignupDetails } from '@/lib/storage'
import { ageProblem, isClean, nameProblem } from '@/lib/validate'
import type { ClinicListing, PatientSession } from '@/types'

/**
 * First-time setup: choose a clinic, confirm the patient's details, register there.
 * Joining answers with a session pinned to the new profile; `signIn` then opens the app.
 */
export function useJoinFlow() {
  const toast = useToast()
  const { data: session, signIn } = useSession<PatientSession>()
  const join = useJoinClinic()
  const [step, setStep] = useState<'clinic' | 'details'>('clinic')
  const [clinic, setClinic] = useState<ClinicListing | null>(null)
  const [name, setName] = useState(session?.account?.name ?? '')
  const [age, setAge] = useState('')
  const [gender, setGender] = useState('')
  const [errors, setErrors] = useState<{ name?: string; age?: string }>({})

  // Age and gender typed at sign-up a moment ago, when this is the same account.
  const mobile = session?.account?.mobile
  useEffect(() => {
    if (!mobile) return
    let alive = true
    void recallSignupDetails(mobile).then((saved) => {
      if (!alive || !saved) return
      setAge((current) => current || saved.age)
      setGender((current) => current || saved.gender)
    })
    return () => {
      alive = false
    }
  }, [mobile])

  const submit = () => {
    if (!clinic || join.isPending) return
    const found = { name: nameProblem(name, "the patient's"), age: ageProblem(age) }
    setErrors(found)
    if (!isClean(found)) return
    join.mutate(
      { clinic_id: clinic.id, name: name.trim(), gender, age: age ? Number(age) : undefined },
      {
        onSuccess: async (payload) => {
          await forgetSignupDetails()
          await signIn(payload)
        },
        onError: (error) => {
          toast.error(error)
          // 403/404: the clinic stopped taking registrations. Back to the list to pick another.
          if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
            setClinic(null)
            setStep('clinic')
          }
        },
      },
    )
  }

  return {
    step,
    clinic,
    name,
    age,
    gender,
    errors,
    joining: join.isPending,
    accountName: session?.account?.name ?? '',
    setClinic,
    setName,
    setAge,
    setGender,
    submit,
    toDetails: () => setStep('details'),
    toClinics: () => setStep('clinic'),
  }
}
