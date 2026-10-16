import { MascotDialog } from '../../ui/mascot'

/** "logout" (dentor.fig 316, 442): the sad tooth asks before signing out. Keeps the confirm-yes / confirm-no ids the tests use. */
export function LogoutDialog({ visible, mascot, onCancel, onConfirm }: { visible: boolean; mascot: number | string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <MascotDialog
      testID="confirm-sheet"
      visible={visible}
      image={mascot}
      tone="danger"
      title="Oh no! You're Leaving..."
      message="Are you sure?"
      onClose={onCancel}
      actions={[
        { label: 'Yes, Log Me Out', testID: 'confirm-yes', onPress: onConfirm },
        { label: 'Nah, Still here', testID: 'confirm-no', secondary: true, onPress: onCancel },
      ]}
    />
  )
}
