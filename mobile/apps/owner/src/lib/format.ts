import { fmtINR, fmtINRCompact } from '@dentor/shared'

const ONE_CRORE = 1e7

/**
 * Rupees for tiles and rows: the exact figure while it fits on a phone (below ₹1 crore),
 * the compact form (₹1.2Cr) above that.
 */
export const fmtMoney = (n: number | null | undefined) => (Math.abs(Number(n ?? 0)) >= ONE_CRORE ? fmtINRCompact(n) : fmtINR(n))

/** "1 invoice", "3 invoices". */
export const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`

/** A stable, selector-friendly fragment for testIDs built from a label ("Clinic Owner" → "clinic-owner"). */
export const slug = (label: string) => label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
