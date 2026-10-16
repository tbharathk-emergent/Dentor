import { Card, Divider, Section, leadStageTone, space } from '@dentor/shared'
import { View } from 'react-native'
import { CountBreakdown } from '@/components/CountBreakdown'
import { Figure, FigureGrid } from '@/components/Figure'
import { fmtMoney } from '@/lib/format'
import type { Operations } from '@/types'

const LEAD_STAGE_ORDER = ['New', 'Contacted', 'Qualified', 'Consultation', 'Converted', 'Lost']

/** Enquiries by stage. Pipeline value counts leads that are neither converted nor lost. */
export function LeadsCard({ leads }: { leads: Operations['leads'] }) {
  return (
    <Section title="Leads">
      <Card padded={false} testID="leads-card">
        <View style={{ padding: space.lg }}>
          <FigureGrid>
            <Figure testID="leads-total" label="LEADS" value={leads.total} />
            <Figure testID="leads-pipeline" label="OPEN PIPELINE VALUE" value={fmtMoney(leads.pipeline_value)} />
          </FigureGrid>
        </View>
        <Divider />
        <View style={{ padding: space.lg }}>
          <CountBreakdown testID="leads-by-stage" counts={leads.by_stage} order={LEAD_STAGE_ORDER} toneOf={leadStageTone} emptyText="No leads have been recorded yet." />
        </View>
      </Card>
    </Section>
  )
}
