import { Avatar, Banner, Button, Card, EmptyState, KeyValue, ListRow, QueryState, Screen, Section, Segmented, StatTile, StatusBadge, T, TileGrid, colors, fmtDate, fmtINR, space, todayISO, useLocalSearchParams } from '@dentor/shared'
import { useState } from 'react'
import { View } from 'react-native'
import { usePatient } from '@/clinic/hooks'
import { AppointmentCard } from '@/components/clinic/AppointmentCard'
import { useRefresh } from '@/hooks/useRefresh'
import { useRouter } from '@/nav'

type Tab = 'appointments' | 'clinical' | 'accounts' | 'profile' | 'consent'

/**
 * "PATIENTS individual dashboard" (dentor.fig 7977:3276) and its pages: appointments by state (7977:4354,
 * 4430, 4506), clinical profile, single and multi-visit (7977:3785, 3955), accounts and payments
 * (7977:3370, 3423), profile (7977:4201) and consent (7977:4277). Money shows only for roles that may see it.
 */
export default function PatientDashboardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const patient = usePatient(id)
  const { refreshing, refresh } = useRefresh(patient)
  const [tab, setTab] = useState<Tab>('appointments')
  const [state, setState] = useState<'upcoming' | 'completed' | 'cancelled'>('upcoming')

  return (
    <Screen testID="patient-screen" title="Patient" back refreshing={refreshing} onRefresh={refresh}>
      <QueryState query={patient}>
        {(d) => {
          const p = d.profile
          const tabs: { key: Tab; label: string }[] = [
            { key: 'appointments', label: 'Visits' },
            { key: 'clinical', label: 'Clinical' },
            ...(d.money ? [{ key: 'accounts' as const, label: 'Accounts' }] : []),
            { key: 'profile', label: 'Profile' },
            { key: 'consent', label: 'Consent' },
          ]
          const today = todayISO()
          const visits = d.appointments.items.filter((a) =>
            state === 'cancelled' ? a.status === 'Cancelled' : state === 'completed' ? a.status === 'Completed' || (a.status !== 'Cancelled' && a.date < today) : a.status !== 'Cancelled' && a.status !== 'Completed' && a.date >= today)
          return (
            <>
              <Card>
                <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
                  <Avatar name={String(p.name)} size={56} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T variant="h3" numberOfLines={1} testID="patient-name">{String(p.name)}</T>
                    <T variant="small" color={colors.textMuted}>{[p.code, p.blood ? `${p.blood} Blood Type` : ''].filter(Boolean).join(' · ')}</T>
                  </View>
                  <StatusBadge status={String(p.status || 'Active')} />
                </View>
                {!!p.allergy && <Banner tone="red" icon="alert-triangle" text={`Allergy: ${p.allergy}`} />}
              </Card>
              <TileGrid>
                <StatTile testID="tile-appointments" label="Appointments" value={d.tiles.appointments} icon="calendar" onPress={() => setTab('appointments')} />
                <StatTile testID="tile-clinical" label="Clinical chart" value={d.tiles.clinical_chart} icon="activity" tone="green" onPress={() => setTab('clinical')} />
                <StatTile label="E-prescription" value={d.tiles.prescriptions} icon="file-text" tone="blue" />
                <StatTile label="Reports" value={d.tiles.reports} icon="folder" tone="violet" />
                <StatTile label="Imaging" value={d.tiles.imaging} icon="image" tone="slate" />
                <StatTile label="CBCT report" value={d.tiles.cbct} icon="layers" tone="slate" />
                {d.accounts && <StatTile testID="tile-outstanding" label="Outstanding" value={fmtINR(d.accounts.balance)} icon="alert-circle" tone="red" onPress={() => setTab('accounts')} />}
                {d.accounts && <StatTile label="Receipts" value={d.accounts.payments.length} icon="check-square" tone="green" onPress={() => setTab('accounts')} />}
              </TileGrid>
              {d.can_change && (
                <Button testID="patient-book" label="Book appointment" icon="calendar" variant="secondary" full onPress={() => router.push('/appointments/new')} />
              )}
              <Segmented options={tabs} value={tab} onChange={setTab} />

              {tab === 'appointments' && (
                <Section>
                  <Segmented
                    options={[
                      { key: 'upcoming', label: `Scheduled (${d.appointments.counts.upcoming})` },
                      { key: 'completed', label: `Previous (${d.appointments.counts.completed})` },
                      { key: 'cancelled', label: `Cancelled (${d.appointments.counts.cancelled})` },
                    ]}
                    value={state}
                    onChange={setState}
                  />
                  {visits.length ? visits.map((a) => (
                    <AppointmentCard key={a.id} appointment={a} showDate onPress={() => router.push({ pathname: '/appointments/[id]', params: { id: a.id } })} />
                  )) : <EmptyState icon="calendar" title="Nothing here" />}
                </Section>
              )}

              {tab === 'clinical' && (
                <Section title={d.clinical.multi_visit ? `Multi-visit treatment (${d.clinical.multi_visit} in progress)` : 'Treatments'}>
                  {d.clinical.treatments.length ? d.clinical.treatments.map((t, i) => (
                    <ListRow key={i} title={t.name} subtitle={[t.tooth && `Tooth ${t.tooth}`, t.doctor, fmtDate(t.date)].filter(Boolean).join(' · ')} meta={t.notes} right={<StatusBadge status={t.status} />} />
                  )) : <EmptyState icon="activity" title="No treatments recorded" />}
                  {d.clinical.procedures.length > 0 && <T variant="smallStrong">Procedures</T>}
                  {d.clinical.procedures.map((t, i) => (
                    <ListRow key={`p${i}`} title={t.name} subtitle={[t.tooth && `Tooth ${t.tooth}`, t.doctor, fmtDate(t.date)].filter(Boolean).join(' · ')} right={<StatusBadge status={t.status} />} />
                  ))}
                </Section>
              )}

              {tab === 'accounts' && d.accounts && (
                <Section title="Patient Accounts">
                  <Card>
                    <KeyValue label="Billed" value={fmtINR(d.accounts.billed)} />
                    <KeyValue label="Paid" value={fmtINR(d.accounts.paid)} />
                    <KeyValue label="Balance" value={fmtINR(d.accounts.balance)} strong />
                  </Card>
                  <T variant="smallStrong">Invoices</T>
                  {d.accounts.invoices.length ? d.accounts.invoices.map((i) => (
                    <ListRow key={i.id} title={`${i.number} · ${i.treatment}`} subtitle={`${fmtDate(i.date)} · total ${fmtINR(i.total)} · paid ${fmtINR(i.paid)}`} right={<StatusBadge status={i.status} />} />
                  )) : <T variant="small" color={colors.textMuted}>No invoices.</T>}
                  <T variant="smallStrong">Payments</T>
                  {d.accounts.payments.length ? d.accounts.payments.map((x) => (
                    <ListRow key={x.receipt} title={`${fmtINR(x.amount)} · ${x.mode}`} subtitle={`${x.receipt} · ${fmtDate(x.date)}${x.invoice ? ` · ${x.invoice}` : ''}`} />
                  )) : <T variant="small" color={colors.textMuted}>No payments.</T>}
                </Section>
              )}

              {tab === 'profile' && (
                <Card>
                  <KeyValue label="Patient ID" value={String(p.code)} />
                  <KeyValue label="Mobile" value={String(p.mobile)} />
                  <KeyValue label="Email" value={String(p.email || '')} />
                  <KeyValue label="Age, gender" value={[p.age ? `${p.age} yrs` : '', p.gender].filter(Boolean).join(', ')} />
                  <KeyValue label="Date of birth" value={p.dob ? fmtDate(String(p.dob)) : ''} />
                  <KeyValue label="Address" value={[p.address, p.city].filter(Boolean).join(', ')} />
                  <KeyValue label="Reason for visit" value={String(p.visitReason || '')} />
                  <KeyValue label="Blood pressure" value={p.vitals?.bp ? `${p.vitals.bp} mmHg` : ''} />
                  <KeyValue label="Blood glucose" value={p.vitals?.glucose ? `${p.vitals.glucose} mg/dL` : ''} />
                  <KeyValue label="History" value={String(p.history || '')} />
                  <KeyValue label="Insurance" value={[p.insurance?.company, p.insurance?.policy].filter(Boolean).join(' · ')} />
                  <KeyValue label="Emergency contact" value={[p.emergencyName, p.emergencyMobile].filter(Boolean).join(' · ')} />
                  <KeyValue label="Source" value={String(p.source || '')} />
                </Card>
              )}

              {tab === 'consent' && (
                <Section title="Consent forms">
                  {d.consents.length ? d.consents.map((c, i) => (
                    <ListRow key={i} title={c.title} subtitle={c.date ? fmtDate(c.date) : ''} right={<StatusBadge status={c.status} />} />
                  )) : <EmptyState icon="file-text" title="No consent forms" message="Consent forms are prepared at the reception web app." />}
                </Section>
              )}
            </>
          )
        }}
      </QueryState>
    </Screen>
  )
}
