import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import type { LoadState } from '@/lib/hooks'
import { EmptyState, ListSkeleton, LoadError } from './bits'

export interface Column<T> {
  key: string
  header: ReactNode
  cell: (row: T) => ReactNode
  /** hide this column below the given breakpoint (mobile card view shows mobileCell instead) */
  className?: string
  align?: 'left' | 'right' | 'center'
}

/**
 * Responsive data display: a real table on >=md screens,
 * card list on small screens (rendered via `mobileCard`).
 *
 * `load` is the state of the request the rows come from: the table shows its own skeleton and its
 * own "could not load" message, and `empty` only when the request succeeded with nothing in it.
 * Leave it out only where a parent `Loaded` already made sure of that.
 */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  load,
  what = 'this list',
  empty,
  mobileCard,
  footer,
}: {
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  load?: LoadState
  /** Completes "Could not load …". */
  what?: string
  empty?: ReactNode
  mobileCard: (row: T) => ReactNode
  footer?: ReactNode
}) {
  if (load?.failed) return <LoadError what={what} load={load} />
  if (load?.loading) return <ListSkeleton rows={6} />
  const stale = load?.stale ? <LoadError compact what={what} load={load} className="m-3" /> : null
  if (!rows.length)
    return <>{stale}{empty ?? <EmptyState title="Nothing here yet" message="Records you add will appear here." />}</>

  return (
    <>
      {stale}
      {/* Mobile cards */}
      <ul className="divide-y divide-slate-100 md:hidden">
        {rows.map((row) => (
          <li
            key={rowKey(row)}
            onClick={() => onRowClick?.(row)}
            className={cn('px-4 py-3', onRowClick && 'cursor-pointer active:bg-slate-50')}
          >
            {mobileCard(row)}
          </li>
        ))}
      </ul>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    'whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500',
                    c.align === 'right' && 'text-right',
                    c.align === 'center' && 'text-center',
                    c.className,
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={() => onRowClick?.(row)}
                className={cn('transition-colors', onRowClick && 'cursor-pointer hover:bg-slate-50/80')}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      'px-4 py-3 align-middle',
                      c.align === 'right' && 'text-right',
                      c.align === 'center' && 'text-center',
                      c.className,
                    )}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footer}
    </>
  )
}
