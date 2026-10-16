import { Banner, Button, Card, Divider, IconTile, ListRow, Sheet, T, TextField, colors, errorMessage, fmtFileSize, space, useToast } from '@dentor/shared'
import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useUploadReport } from '@/hooks/useReports'
import { pickDocument, pickImage, type PickedFile } from '@/lib/pickers'
import { reportProblem } from '@/lib/uploads'

type Source = 'photo' | 'pdf'

/** Choose a photo or a PDF, name it and send it to the clinic. Oversized or unsupported files are refused here. */
export function UploadSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const toast = useToast()
  const upload = useUploadReport()
  const [file, setFile] = useState<PickedFile | null>(null)
  const [name, setName] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | undefined>()
  const [opening, setOpening] = useState<Source | null>(null)

  useEffect(() => {
    if (visible) return
    setFile(null)
    setName('')
    setProblem(null)
    setNameError(undefined)
    setOpening(null)
  }, [visible])

  const choose = async (source: Source) => {
    setOpening(source)
    setProblem(null)
    try {
      const picked = source === 'photo' ? await pickImage() : await pickDocument()
      if (!picked) return
      const refused = reportProblem(picked)
      if (refused) {
        setFile(null)
        setProblem(refused)
        return
      }
      setFile(picked)
      setName(picked.name.replace(/\.[A-Za-z0-9]+$/, '').slice(0, 120))
      setNameError(undefined)
    } catch (error) {
      setProblem(errorMessage(error, 'Could not open that file. Please try another one.'))
    } finally {
      setOpening(null)
    }
  }

  const submit = () => {
    if (!file) return
    if (!name.trim()) {
      setNameError('Give the file a name so the clinic knows what it is.')
      return
    }
    upload.mutate(
      { name: name.trim(), dataUrl: file.dataUrl, size: file.size },
      {
        onSuccess: () => {
          toast.success('File uploaded')
          onClose()
        },
        onError: (error) => toast.error(error),
      },
    )
  }

  return (
    <Sheet
      testID="upload-sheet"
      visible={visible}
      onClose={onClose}
      title="Upload a file"
      subtitle="Share an X-ray, report or photo with your clinic"
      footer={<Button testID="upload-submit" label="Upload" icon="upload" onPress={submit} disabled={!file} loading={upload.isPending} full />}
    >
      {!!problem && (
        <View testID="upload-problem">
          <Banner tone="red" icon="alert-circle" text={problem} />
        </View>
      )}

      {file ? (
        <>
          <Card testID="upload-chosen" style={styles.chosen}>
            <IconTile icon={file.mime.startsWith('image/') ? 'image' : 'file-text'} />
            <View style={styles.chosenText}>
              <T variant="bodyStrong" numberOfLines={1}>{file.name}</T>
              <T variant="small" color={colors.textMuted}>{fmtFileSize(file.size)}</T>
            </View>
          </Card>
          <TextField
            testID="upload-name"
            label="Name"
            required
            value={name}
            onChangeText={setName}
            placeholder="e.g. X-ray from March"
            maxLength={120}
            error={nameError}
          />
          <Button testID="upload-change" label="Choose a different file" variant="ghost" onPress={() => setFile(null)} disabled={upload.isPending} style={styles.change} />
        </>
      ) : (
        <>
          <Card padded={false}>
            <ListRow
              testID="upload-photo"
              title={opening === 'photo' ? 'Opening your photos…' : 'Choose a photo'}
              subtitle="PNG, JPG, WEBP or HEIC"
              left={<IconTile icon="image" />}
              onPress={() => choose('photo')}
              chevron
            />
            <Divider inset={space.lg} />
            <ListRow
              testID="upload-pdf"
              title={opening === 'pdf' ? 'Opening your files…' : 'Choose a PDF'}
              subtitle="A report or letter saved as PDF"
              left={<IconTile icon="file-text" tone="blue" />}
              onPress={() => choose('pdf')}
              chevron
            />
          </Card>
          <T variant="small" color={colors.textMuted}>Files can be up to 5 MB.</T>
        </>
      )}
    </Sheet>
  )
}

const styles = StyleSheet.create({
  chosen: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  chosenText: { flex: 1, minWidth: 0 },
  change: { alignSelf: 'center' },
})
