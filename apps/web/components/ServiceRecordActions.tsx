'use client'

import { useFormStatus } from 'react-dom'
import {
  confirmServiceRecord,
  deleteServiceRecord,
} from '@/app/actions/services'

function PendingButton({
  variant,
  children,
}: {
  variant: 'confirm' | 'retract' | 'delete' | 'edit'
  children: React.ReactNode
}) {
  const { pending } = useFormStatus()
  const base =
    'inline-flex items-center gap-1.5 text-xs tracking-widest uppercase font-semibold px-4 py-2 rounded-pill transition-colors disabled:opacity-60 disabled:pointer-events-none'
  const styles =
    variant === 'confirm'
      ? 'text-noir bg-volt hover:bg-volt/90'
      : variant === 'retract'
        ? 'font-medium text-wallet bg-wallet/10 hover:bg-wallet/20 border border-wallet/30'
        : 'font-medium text-ash hover:text-signal hover:bg-signal/10 border border-seam hover:border-signal/30'
  return (
    <button type="submit" formNoValidate disabled={pending} className={`${base} ${styles}`}>
      {pending ? 'Working…' : children}
    </button>
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
      <PendingButton variant="confirm">Confirm</PendingButton>
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
      <PendingButton variant="retract">Retract</PendingButton>
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
      <PendingButton variant="delete">Delete</PendingButton>
    </form>
  )
}
