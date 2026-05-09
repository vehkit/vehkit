'use client'

import { useFormStatus } from 'react-dom'
import {
  confirmServiceRecord,
  deleteServiceRecord,
} from '@/app/actions/services'

/**
 * Compact icon-style action buttons for service record rows.
 * 32px round, no chunky pill chrome. Show pending state via opacity on submit.
 */
function IconSubmit({
  tone,
  label,
  children,
}: {
  tone: 'volt' | 'wallet' | 'signal' | 'ash'
  label: string
  children: React.ReactNode
}) {
  const { pending } = useFormStatus()
  const styles =
    tone === 'volt'
      ? 'bg-volt text-noir hover:bg-volt/90'
      : tone === 'wallet'
        ? 'bg-wallet/15 text-wallet hover:bg-wallet/25 border border-wallet/30'
        : tone === 'signal'
          ? 'bg-signal/10 text-signal hover:bg-signal/20 border border-signal/30'
          : 'bg-iron text-ash hover:bg-iron/70 border border-seam'
  return (
    <button
      type="submit"
      formNoValidate
      disabled={pending}
      aria-label={label}
      title={label}
      className={`w-9 h-9 inline-flex items-center justify-center rounded-pill transition-colors disabled:opacity-60 disabled:pointer-events-none ${styles}`}
    >
      {pending ? <span className="text-[10px]">…</span> : children}
    </button>
  )
}

const ICON_SIZE = 16

function CheckIcon() {
  return (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function UndoIcon() {
  return (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="3 7 8 7 8 12" />
      <path d="M5.5 9.5A8 8 0 1 0 12 4" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )
}

export function ConfirmButton({
  recordId,
  vehicleId,
}: {
  recordId: string
  vehicleId: string
}) {
  return (
    <form action={confirmServiceRecord}>
      <input type="hidden" name="id" value={recordId} />
      <input type="hidden" name="vehicle_id" value={vehicleId} />
      <IconSubmit tone="volt" label="Confirm entry">
        <CheckIcon />
      </IconSubmit>
    </form>
  )
}

export function RetractButton({
  recordId,
  vehicleId,
}: {
  recordId: string
  vehicleId: string
}) {
  return (
    <form action={deleteServiceRecord}>
      <input type="hidden" name="id" value={recordId} />
      <input type="hidden" name="vehicle_id" value={vehicleId} />
      <IconSubmit tone="wallet" label="Retract entry">
        <UndoIcon />
      </IconSubmit>
    </form>
  )
}

export function DeleteButton({
  recordId,
  vehicleId,
}: {
  recordId: string
  vehicleId: string
}) {
  return (
    <form action={deleteServiceRecord}>
      <input type="hidden" name="id" value={recordId} />
      <input type="hidden" name="vehicle_id" value={vehicleId} />
      <IconSubmit tone="ash" label="Delete entry">
        <TrashIcon />
      </IconSubmit>
    </form>
  )
}
