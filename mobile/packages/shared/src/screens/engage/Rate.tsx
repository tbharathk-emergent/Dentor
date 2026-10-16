import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { api, errorMessage } from '../../api'
import { colors, space } from '../../theme'
import { Sheet, useToast } from '../../ui/feedback'
import { Banner, Button, Chip, Row, T, TextField } from '../../ui/primitives'

/**
 * "rate Your Experience" (dentor.fig 368, 437–441): stars, would you recommend, what went well and a review, after a
 * completed visit. The clinic rates the consultant; the consultant rates the clinic. Once per side.
 */
export function RateVisitSheet({ bookingId, visible, title, aspects, onClose, onDone }: {
  bookingId: string
  visible: boolean
  title: string
  aspects: string[]
  onClose: () => void
  onDone?: () => void
}) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [stars, setStars] = useState(0)
  const [recommend, setRecommend] = useState<boolean | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const rate = useMutation({ mutationFn: () => api.post('/api/engage/ratings', { booking_id: bookingId, stars, recommend, aspects: picked, text: text.trim() }) })
  return (
    <Sheet testID="rate-sheet" visible={visible} onClose={onClose} title={title}
      footer={<Button testID="rate-submit" label="Submit" size="lg" full loading={rate.isPending} onPress={() => {
        if (!stars) return setError('Choose the stars.')
        rate.mutate(undefined, {
          onSuccess: () => { toast.success('Thanks for your ratings.'); void queryClient.invalidateQueries(); onDone?.(); onClose() },
          onError: (e) => setError(errorMessage(e)),
        })
      }} />}>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} testID={`star-${n}`} accessibilityRole="button" accessibilityLabel={`${n} star${n === 1 ? '' : 's'}`} onPress={() => setStars(n)} hitSlop={6}>
            <Text style={[styles.star, n <= stars && { color: '#fdc500' }]}>★</Text>
          </Pressable>
        ))}
      </View>
      <T variant="smallStrong">Would you recommend them?</T>
      <Row gap={space.sm}>
        <Chip testID="recommend-yes" label="Yes, I recommend" selected={recommend === true} onPress={() => setRecommend(true)} />
        <Chip label="No" selected={recommend === false} onPress={() => setRecommend(false)} />
      </Row>
      <Row wrap gap={space.xs}>{aspects.map((a) => <Chip key={a} label={a} selected={picked.includes(a)} onPress={() => setPicked((p) => (p.includes(a) ? p.filter((x) => x !== a) : [...p, a]))} />)}</Row>
      <TextField testID="rate-text" label="Write a review" value={text} onChangeText={setText} multiline maxLength={1000} />
      {!!error && <Banner tone="red" icon="alert-circle" text={error} />}
    </Sheet>
  )
}

const styles = StyleSheet.create({
  stars: { flexDirection: 'row', justifyContent: 'center', gap: space.md },
  star: { fontSize: 36, color: colors.border },
})
