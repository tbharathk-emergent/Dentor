import { ConfirmSheet, EmptyState, QueryState, Screen, useToast } from '@dentor/shared'
import { useState } from 'react'
import { Rows } from '@/components/Rows'
import { ConsentCard } from '@/components/consents/ConsentCard'
import { useConsents, useSignConsent } from '@/hooks/useConsents'
import { useRefresh } from '@/hooks/useRefresh'
import type { Consent } from '@/types'

export default function Consents() {
  const toast = useToast()
  const list = useConsents()
  const sign = useSignConsent()
  const { refreshing, onRefresh } = useRefresh(list.refetch)
  // The form being confirmed stays set while the sheet closes, so its title does not blank out.
  const [target, setTarget] = useState<Consent | null>(null)
  const [confirming, setConfirming] = useState(false)

  const ask = (consent: Consent) => {
    setTarget(consent)
    setConfirming(true)
  }

  const confirmSign = () => {
    if (!target) return
    sign.mutate(target.id, {
      onSuccess: () => toast.success(`${target.title} signed`),
      onError: (error) => toast.error(error),
      onSettled: () => setConfirming(false),
    })
  }

  return (
    <Screen testID="consents-screen" title="Consent Forms" back refreshing={refreshing} onRefresh={onRefresh}>
      <QueryState query={list}>
        {(data) =>
          data.items.length === 0 ? (
            <EmptyState testID="consents-empty" icon="edit-3" title="No consent forms" message="Forms the clinic asks you to sign before a treatment appear here." />
          ) : (
            <Rows testID="consent-list">
              {data.items.map((consent) => (
                <ConsentCard key={consent.id} consent={consent} onSign={() => ask(consent)} />
              ))}
            </Rows>
          )
        }
      </QueryState>
      <ConfirmSheet
        visible={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={confirmSign}
        title={`Sign ${target?.title ?? 'this form'}?`}
        message="By signing you confirm that the clinic has explained this form to you and that you agree to it. A signed form cannot be un-signed in the app."
        confirmLabel="Sign form"
        loading={sign.isPending}
      />
    </Screen>
  )
}
