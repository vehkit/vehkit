'use client'

import { useState, useTransition } from 'react'
import { suggestReminder } from '@/app/actions/workshop'
import { REMINDER_TYPES } from '@vehkit/types'

export function SuggestReminderButton({
  workshopId,
  vehicleId,
  vehicleName,
}: {
  workshopId: string
  vehicleId: string
  vehicleName: string
}) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<string>('')
  const [dueDate, setDueDate] = useState('')
  const [dueAtKm, setDueAtKm] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [pending, startTransition] = useTransition()

  function reset() {
    setType('')
    setDueDate('')
    setDueAtKm('')
    setNotes('')
    setError(null)
    setSuccess(false)
  }

  function close() {
    setOpen(false)
    setTimeout(reset, 200)
  }

  function submit() {
    if (!type) {
      setError('Pick a reminder type')
      return
    }
    if (!dueDate && !dueAtKm) {
      setError('Provide a due date or km target')
      return
    }
    setError(null)

    startTransition(async () => {
      const result = await suggestReminder({
        workshopId,
        vehicleId,
        reminderType: type,
        dueDate: dueDate || null,
        dueAtKm: dueAtKm ? Number(dueAtKm) : null,
        notes: notes || null,
      })
      if (result?.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        setTimeout(close, 1200)
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[10px] tracking-widest uppercase text-volt hover:underline font-medium"
      >
        Suggest →
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-noir/80 backdrop-blur-sm flex items-end md:items-center justify-center"
          onClick={close}
        >
          <div
            className="w-full md:max-w-md bg-carbon border border-seam rounded-t-2xl md:rounded-DEFAULT p-5 md:m-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-[10px] tracking-widest uppercase text-ash">Suggest reminder</p>
                <h3 className="text-lg font-semibold text-chalk tracking-tight mt-0.5">
                  {vehicleName}
                </h3>
              </div>
              <button
                type="button"
                onClick={close}
                className="text-ash hover:text-chalk text-2xl leading-none -mr-1 -mt-1"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {success ? (
              <div className="py-6 text-center">
                <p className="text-volt text-2xl">✓</p>
                <p className="text-sm text-chalk mt-2">Reminder suggested</p>
                <p className="text-xs text-ash mt-1">Owner will see it in their inbox.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="label">
                    Type <span className="text-signal">*</span>
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="field"
                  >
                    <option value="" disabled>
                      Pick one…
                    </option>
                    {REMINDER_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Due date</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="field"
                    />
                  </div>
                  <div>
                    <label className="label">Due at km</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={dueAtKm}
                      onChange={(e) => setDueAtKm(e.target.value)}
                      placeholder="e.g. 95000"
                      className="field"
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Optional context for the owner"
                    className="field resize-none"
                  />
                </div>

                {error && (
                  <p className="text-xs text-signal bg-signal/10 border border-signal/30 px-3 py-2 rounded-DEFAULT">
                    {error}
                  </p>
                )}

                <p className="text-[11px] text-ash leading-relaxed">
                  Suggested reminders show up in the owner's inbox marked as suggested by your
                  workshop. The owner can accept, snooze, or dismiss.
                </p>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={close}
                    className="pill-ghost flex-1 text-sm"
                    disabled={pending}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submit}
                    className="pill-primary flex-[2] text-sm"
                    disabled={pending}
                  >
                    {pending ? 'Sending…' : 'Suggest reminder'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
