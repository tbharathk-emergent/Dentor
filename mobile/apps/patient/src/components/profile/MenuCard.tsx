import { MenuRows, type MenuRow } from '@dentor/shared'

export type MenuItem = MenuRow

/** The design's settings-style rows (shared with the staff apps). Each row gets the testID `menu-<key>`. */
export function MenuCard({ items, size }: { items: MenuItem[]; size?: 18 | 20 }) {
  return <MenuRows items={items} size={size} />
}
