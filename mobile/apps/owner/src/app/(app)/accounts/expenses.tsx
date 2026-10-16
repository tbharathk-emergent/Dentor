import { Banner, Button, Chip, EmptyState, QueryState, Row, Screen, Sheet, T, TextField, colors, errorMessage, face, fmtINR, radius, shadow, space, stripeColors, todayISO, useLocalSearchParams, useToast } from '@dentor/shared'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { EXPENSE_CATEGORIES, useAddExpense, useExpenses } from '@/clinic/accounts'
import { PeriodControl } from '@/components/PeriodControl'
import { usePeriod } from '@/hooks/usePeriod'
import { useRefresh } from '@/hooks/useRefresh'

const MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque']

/**
 * "Expenses" (dentor.fig 203–210): by category — consultant, duty doctors, purchase, lab orders,
 * miscellaneous, staff, domestic. Lab payments and consultant visit fees come in by themselves.
 */
export default function Expenses() {
  const params = useLocalSearchParams<{ category?: string }>()
  const period = usePeriod()
  const [category, setCategory] = useState(params.category ?? '')
  const [adding, setAdding] = useState(false)
  const list = useExpenses(period.range, category || undefined)
  const { refreshing, refresh } = useRefresh(list)
  return (
    <Screen testID="expenses-screen" title="Expenses" back refreshing={refreshing} onRefresh={refresh}
      footer={<Button testID="expense-add" label="Add expense" icon="plus" size="lg" full onPress={() => setAdding(true)} />}>
      <PeriodControl scope="expenses" />
      <Row wrap gap={space.xs}>
        <Chip testID="expenses-all" label="All" selected={!category} onPress={() => setCategory('')} />
        {EXPENSE_CATEGORIES.map((c) => <Chip key={c} testID={`expenses-${c}`} label={c} selected={category === c} onPress={() => setCategory(c)} />)}
      </Row>
      <QueryState query={list}>
        {(data) => (
          <>
            {/* the design's red "TOTAL EXPENSES" card (dentor.fig 203) */}
            <View style={styles.total}>
              <Text style={styles.totalLabel}>{category ? `TOTAL · ${category.toUpperCase()}` : 'TOTAL EXPENSES'}</Text>
              <Text testID="expenses-total" style={styles.totalValue}>{fmtINR(data.total)}</Text>
              <Text style={styles.totalLabel}>{data.items.length} entr{data.items.length === 1 ? 'y' : 'ies'}</Text>
            </View>
            {data.items.length ? (
              <View style={{ gap: space.md }}>
                {/* green-edged lines with the amount on the right, as dentor.fig "consultant / expenses" (204) */}
                {data.items.map((x) => (
                  <View key={`${x.source}-${x.id}`} testID={`expense-${x.code}`} style={styles.card}>
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Text style={styles.payee} numberOfLines={1}>{x.payee}</Text>
                      <Text style={styles.line} numberOfLines={1}>{x.date_label}{x.mode ? ` · ${x.mode}` : ''}</Text>
                      <Text style={styles.line} numberOfLines={2}>{[x.category, x.description].filter(Boolean).join(' · ')}</Text>
                      {x.source !== 'Recorded' && <Text style={styles.from}>from {x.source.toLowerCase()}</Text>}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.amountLabel}>Amount</Text>
                      <Text style={styles.amount}>{fmtINR(x.amount)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : <EmptyState icon="credit-card" title="No expenses in this period" />}
          </>
        )}
      </QueryState>
      <AddExpense visible={adding} initial={category} onClose={() => setAdding(false)} />
    </Screen>
  )
}

function AddExpense({ visible, initial, onClose }: { visible: boolean; initial: string; onClose: () => void }) {
  const toast = useToast()
  const add = useAddExpense()
  const [category, setCategory] = useState(initial)
  const [amount, setAmount] = useState('')
  const [payee, setPayee] = useState('')
  const [description, setDescription] = useState('')
  const [mode, setMode] = useState('Cash')
  const [reference, setReference] = useState('')
  const [date, setDate] = useState(todayISO())
  const [error, setError] = useState<string | null>(null)
  const save = () => {
    const value = Number(amount.replace(/[,₹\s]/g, ''))
    if (!category) return setError('Choose the category.')
    if (!Number.isFinite(value) || value <= 0) return setError('Enter the amount.')
    if (!payee.trim()) return setError('Say who was paid.')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('Use the form yyyy-mm-dd for the date.')
    add.mutate({ category, amount: value, payee: payee.trim(), description: description.trim(), mode, reference: reference.trim(), date }, {
      onSuccess: () => { toast.success(`${fmtINR(value)} to ${payee.trim()} recorded.`); setAmount(''); setPayee(''); setDescription(''); setReference(''); setError(null); onClose() },
      onError: (e) => setError(errorMessage(e)),
    })
  }
  return (
    <Sheet testID="expense-sheet" visible={visible} onClose={onClose} title="Add expense"
      footer={<Button testID="expense-save" label="Save" size="lg" full loading={add.isPending} onPress={save} />}>
      <T variant="smallStrong">Category</T>
      <Row wrap gap={space.xs}>{EXPENSE_CATEGORIES.map((c) => <Chip key={c} testID={`expense-category-${c}`} label={c} selected={category === c} onPress={() => setCategory(c)} />)}</Row>
      <TextField testID="expense-amount" label="Amount (₹)" required value={amount} onChangeText={setAmount} keyboardType="decimal-pad" maxLength={10} />
      <TextField testID="expense-payee" label="Paid to" required value={payee} onChangeText={setPayee} placeholder="Vendor, staff member, landlord" maxLength={80} />
      <TextField testID="expense-description" label="What for" value={description} onChangeText={setDescription} maxLength={200} />
      <T variant="smallStrong">Mode</T>
      <Row wrap gap={space.xs}>{MODES.map((m) => <Chip key={m} label={m} selected={mode === m} onPress={() => setMode(m)} />)}</Row>
      <TextField label="Reference" value={reference} onChangeText={setReference} placeholder="Bill or transaction number" maxLength={60} />
      <TextField testID="expense-date" label="Date" value={date} onChangeText={setDate} placeholder="yyyy-mm-dd" maxLength={10} />
      {!!error && <Banner testID="expense-error" tone="red" icon="alert-circle" text={error} />}
      <T variant="tiny" color={colors.textMuted}>Lab payments and completed consultant visits are added automatically.</T>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  total: { borderRadius: radius.lg, backgroundColor: colors.header, padding: space.lg, gap: space.xs, ...shadow },
  totalLabel: { ...face('semibold'), fontSize: 12, letterSpacing: 0.5, color: '#ffffff' },
  totalValue: { ...face('bold'), fontSize: 30, color: '#ffffff' },
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, borderLeftWidth: 6, borderLeftColor: stripeColors.done, ...shadow },
  payee: { ...face('semibold'), fontSize: 14, color: colors.textStrong },
  line: { ...face('regular'), fontSize: 13, color: colors.textMuted },
  from: { ...face('regular'), fontSize: 11, color: colors.textMuted, fontStyle: 'italic' },
  amountLabel: { ...face('semibold'), fontSize: 11, color: colors.textStrong },
  amount: { ...face('bold'), fontSize: 18, color: colors.header },
})
