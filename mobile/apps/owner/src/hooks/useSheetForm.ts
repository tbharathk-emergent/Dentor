import { useState } from 'react'

/**
 * Form state for a sheet that is opened again and again. `openKey` is null while the sheet
 * is closed and says what it was opened for otherwise; every opening starts from `initial()`
 * and the values stay put while the sheet slides shut.
 */
export function useSheetForm<Form>(openKey: string | null, initial: () => Form) {
  const [state, setState] = useState(() => ({ key: openKey, form: initial() }))
  let current = state
  if (state.key !== openKey) {
    // Reset while rendering, not in an effect, so the sheet never flashes the previous opening's values.
    current = { key: openKey, form: openKey === null ? state.form : initial() }
    setState(current)
  }
  const update = (changes: Partial<Form>) => setState((previous) => ({ ...previous, form: { ...previous.form, ...changes } }))
  return [current.form, update] as const
}

/** The last non-null value, so a sheet can keep showing what it was opened for while it closes. */
export function useLastValue<Value>(value: Value | null): Value | null {
  const [last, setLast] = useState(value)
  if (value !== null && value !== last) setLast(value)
  return value ?? last
}
