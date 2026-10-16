import { StatTile, TileGrid } from '@dentor/shared'
import { fmtMoney, plural } from '@/lib/format'
import type { Overview } from '@/types'

/** The six headline figures. Money tiles open Finance. */
export function OverviewKpis({ data, onOpenFinance }: { data: Overview; onOpenFinance: () => void }) {
  return (
    <TileGrid>
      <StatTile testID="kpi-billed" icon="file-text" tone="brand" label="Billed" value={fmtMoney(data.billed)} hint={plural(data.invoices, 'invoice')} onPress={onOpenFinance} />
      <StatTile testID="kpi-collected" icon="check-circle" tone="green" label="Collected" value={fmtMoney(data.collected)} hint="Payments received" onPress={onOpenFinance} />
      <StatTile testID="kpi-outstanding" icon="alert-circle" tone="red" label="Outstanding" value={fmtMoney(data.outstanding)} hint="All-time balance due" onPress={onOpenFinance} />
      <StatTile testID="kpi-appointments" icon="calendar" tone="blue" label="Appointments" value={data.appointments} hint="Booked in this period" />
      <StatTile testID="kpi-new-patients" icon="user-plus" tone="violet" label="New patients" value={data.patients_new} hint={`${data.patients_total} registered in all`} />
      <StatTile testID="kpi-average-invoice" icon="bar-chart-2" tone="slate" label="Average invoice" value={fmtMoney(data.average_invoice)} hint="Billed ÷ invoices" />
    </TileGrid>
  )
}
