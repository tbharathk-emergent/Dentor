import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { View } from 'react-native'
import { api, errorMessage } from '../../api'
import { fmtDateTime } from '../../format'
import { colors, space } from '../../theme'
import { Sheet, useToast } from '../../ui/feedback'
import { ListRow, Screen } from '../../ui/layout'
import { Banner, Button, Chip, Row, Segmented, StatusBadge, T, TextField } from '../../ui/primitives'
import { EmptyState, QueryState } from '../../ui/states'

interface Job { id: string; kind: 'hiring' | 'seeking'; title: string; specialty: string; location: string; description: string; contact: string; poster: string; clinic: string; status: string; created_at: string; mine: boolean }

/** Job posts (dentor.fig 328–332): clinics hiring, consultants looking for work, and my posts. */
export function JobsScreen({ canHire, defaultKind }: { canHire: boolean; defaultKind: 'hiring' | 'seeking' }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'hiring' | 'seeking' | 'mine'>(defaultKind)
  const [posting, setPosting] = useState(false)
  const [open, setOpen] = useState<Job | null>(null)
  const list = useQuery<{ items: Job[] }>({ queryKey: ['engage', 'jobs', tab], queryFn: () => api.get(tab === 'mine' ? '/api/engage/jobs?mine=true' : `/api/engage/jobs?kind=${tab}`) })
  const close = useMutation({ mutationFn: (id: string) => api.post(`/api/engage/jobs/${id}/close`) })
  return (
    <Screen testID="jobs-screen" title="Job Posts" back footer={<Button testID="job-new" label={canHire ? 'Post a job' : 'Add post'} icon="plus" size="lg" full onPress={() => setPosting(true)} />}>
      <Segmented options={[{ key: 'hiring', label: 'Hiring' }, { key: 'seeking', label: 'Looking for work' }, { key: 'mine', label: 'My posts' }]} value={tab} onChange={setTab} />
      <QueryState query={list}>
        {(data) => data.items.length ? (
          <View style={{ gap: space.xs }}>
            {data.items.map((j) => (
              <ListRow key={j.id} testID={`job-${j.id}`} title={j.title} subtitle={[j.specialty, j.location || j.clinic, j.poster].filter(Boolean).join(' · ')} meta={fmtDateTime(j.created_at)}
                right={tab === 'mine' ? <StatusBadge status={j.status} /> : undefined} chevron onPress={() => setOpen(j)} />
            ))}
          </View>
        ) : <EmptyState icon="briefcase" title="No post" message={tab === 'mine' ? 'Your posts appear here.' : undefined} />}
      </QueryState>
      <Sheet testID="job-view" visible={!!open} onClose={() => setOpen(null)} title={open?.title ?? ''} subtitle={open ? [open.kind === 'hiring' ? open.clinic : open.poster, open.specialty].filter(Boolean).join(' · ') : ''}
        footer={open?.mine && open.status === 'Open' ? <Button testID="job-close" label="Close this post" variant="ghost" full onPress={() => close.mutate(open.id, {
          onSuccess: () => { setOpen(null); void queryClient.invalidateQueries({ queryKey: ['engage', 'jobs'] }) } })} /> : undefined}>
        <T>{open?.description}</T>
        {!!open?.contact && <T variant="smallStrong">Contact: {open.contact}</T>}
      </Sheet>
      <PostJob visible={posting} canHire={canHire} onClose={() => setPosting(false)} onDone={() => { setPosting(false); setTab('mine'); toast.success('Posted.'); void queryClient.invalidateQueries({ queryKey: ['engage', 'jobs'] }) }} />
    </Screen>
  )
}

function PostJob({ visible, canHire, onClose, onDone }: { visible: boolean; canHire: boolean; onClose: () => void; onDone: () => void }) {
  const [kind, setKind] = useState<'hiring' | 'seeking'>(canHire ? 'hiring' : 'seeking')
  const [f, setF] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const post = useMutation({ mutationFn: () => api.post('/api/engage/jobs', { kind, title: f.title ?? '', specialty: f.specialty ?? '', location: f.location ?? '', description: f.description ?? '', contact: f.contact ?? '' }) })
  const set = (k: string) => (v: string) => setF((x) => ({ ...x, [k]: v }))
  return (
    <Sheet testID="job-sheet" visible={visible} onClose={onClose} title={kind === 'hiring' ? 'Post a job' : 'Add post: job seeking'}
      footer={<Button testID="job-submit" label="Post" size="lg" full loading={post.isPending} onPress={() => post.mutate(undefined, { onSuccess: () => { setF({}); setError(null); onDone() }, onError: (e) => setError(errorMessage(e)) })} />}>
      {canHire && <Row gap={space.sm}><Chip label="Hiring" selected={kind === 'hiring'} onPress={() => setKind('hiring')} /><Chip label="Looking for work" selected={kind === 'seeking'} onPress={() => setKind('seeking')} /></Row>}
      <TextField testID="job-title" label="Title" value={f.title ?? ''} onChangeText={set('title')} maxLength={100} />
      <TextField label="Speciality" value={f.specialty ?? ''} onChangeText={set('specialty')} maxLength={60} />
      <TextField label="Location" value={f.location ?? ''} onChangeText={set('location')} maxLength={60} />
      <TextField testID="job-description" label="Description" value={f.description ?? ''} onChangeText={set('description')} multiline maxLength={1500} />
      <TextField label="Contact" value={f.contact ?? ''} onChangeText={set('contact')} placeholder="Email or phone shown on the post" maxLength={80} />
      {!!error && <Banner tone="red" icon="alert-circle" text={error} />}
      <T variant="tiny" color={colors.textMuted}>Posts are seen by clinics and consultants across Dentor.</T>
    </Sheet>
  )
}
