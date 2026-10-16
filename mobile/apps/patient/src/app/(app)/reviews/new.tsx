import { Banner, Button, Screen, TextField, useToast } from '@dentor/shared'
import { useState } from 'react'
import { ChoiceChips } from '@/components/ChoiceChips'
import { QuickTags } from '@/components/reviews/QuickTags'
import { StarRating } from '@/components/reviews/StarRating'
import { CLINIC_SUBJECT, SubjectPicker } from '@/components/reviews/SubjectPicker'
import { useSubmitReview } from '@/hooks/useReviews'
import { isClean } from '@/lib/validate'
import { useRouter } from '@/nav'

const MIN_TEXT = 3
const RECOMMEND = ['Yes, I recommend', 'No'] as const

// The question above the text box follows the stars, as the design shows it
// (patient-app.fig 74:518 at one star, 74:586 at two).
const reviewPrompt = (rating: number) => (rating === 1 ? 'What Went Wrong?' : rating > 1 && rating < 4 ? 'What Can We Improve?' : 'Write A Review')

export default function NewReview() {
  const router = useRouter()
  const toast = useToast()
  const submitReview = useSubmitReview()
  const [subject, setSubject] = useState(CLINIC_SUBJECT)
  const [rating, setRating] = useState(0)
  const [text, setText] = useState('')
  const [visit, setVisit] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [recommend, setRecommend] = useState('')
  const [errors, setErrors] = useState<{ rating?: string; text?: string }>({})

  const submit = () => {
    const found = {
      rating: rating ? undefined : 'Tap a star to give your rating.',
      text: text.trim().length < MIN_TEXT ? 'Write a few words about your experience.' : undefined,
    }
    setErrors(found)
    if (!isClean(found)) return
    submitReview.mutate(
      { subject, rating, text: text.trim(), visit: visit.trim(), tags, ...(recommend ? { recommend: recommend === RECOMMEND[0] } : {}) },
      {
        onSuccess: () => {
          toast.success('Thank you! Your review was sent to the clinic.')
          if (router.canGoBack()) router.back()
          else router.replace('/reviews')
        },
        onError: (error) => toast.error(error),
      },
    )
  }

  return (
    <Screen
      testID="review-form"
      title="Rate Your Experience"
      back
      footer={<Button testID="review-submit" label="Submit" size="lg" full loading={submitReview.isPending} onPress={submit} />}
    >
      <SubjectPicker value={subject} onChange={setSubject} />
      <StarRating
        label="Your rating"
        value={rating}
        onChange={(stars) => {
          setRating(stars)
          setErrors((current) => ({ ...current, rating: undefined }))
        }}
        error={errors.rating}
      />
      <QuickTags value={tags} onChange={setTags} />
      <TextField
        testID="review-text"
        label={reviewPrompt(rating)}
        required
        value={text}
        onChangeText={(value) => {
          setText(value)
          setErrors((current) => ({ ...current, text: undefined }))
        }}
        placeholder="What went well? What could be better?"
        maxLength={1000}
        multiline
        error={errors.text}
      />
      <TextField
        testID="review-visit"
        label="Treatment or visit (optional)"
        value={visit}
        onChangeText={setVisit}
        placeholder="e.g. Root canal, cleaning"
        maxLength={120}
      />
      <ChoiceChips label="Would you recommend us?" options={RECOMMEND} value={recommend} onChange={setRecommend} clearable testID="review-recommend" />
      <Banner tone="blue" icon="info" text="The clinic reads every review. It is shown as Pending until the clinic approves it." />
    </Screen>
  )
}
