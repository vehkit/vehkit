'use client'

import { useState } from 'react'
import { MAKES, MODELS_BY_MAKE } from '@/lib/car-data'

const OTHER = '__other__'

/**
 * Make + Model picker for the add-car form.
 *
 * Behavior:
 *  - Make is a visible <select>. Native UI on every device — wheel
 *    picker on iOS, dropdown on Android, listbox on desktop. Last
 *    option is "Other / not listed" which reveals a text input.
 *  - Model is also a <select>, but its options are sourced from
 *    MODELS_BY_MAKE[selectedMake]. If a make has no curated model
 *    list (or "Other" was picked), Model degrades to a plain text
 *    field so the user is never blocked.
 *  - Two hidden inputs (`make`, `model`) carry the effective values
 *    into FormData, so the server action signature is unchanged.
 */
export function VehicleMakeModelPicker({
  defaultMake = '',
  defaultModel = '',
}: {
  defaultMake?: string
  defaultModel?: string
}) {
  // Decide initial select state — if defaultMake matches a curated entry,
  // pre-select it; otherwise mark Other and put the raw value in the
  // text field. Same for model.
  const knownMake = MAKES.includes(defaultMake as never)
  const initialMake = knownMake ? defaultMake : defaultMake ? OTHER : ''
  const initialMakeFree = knownMake ? '' : defaultMake

  const [makeSel, setMakeSel] = useState(initialMake)
  const [makeFree, setMakeFree] = useState(initialMakeFree)

  const effectiveMake = makeSel === OTHER ? makeFree.trim() : makeSel
  const curatedModels =
    MODELS_BY_MAKE[effectiveMake] ?? []

  const knownModel =
    curatedModels.length > 0 && curatedModels.includes(defaultModel)
  const initialModel = knownModel
    ? defaultModel
    : defaultModel && curatedModels.length > 0
      ? OTHER
      : ''
  const initialModelFree =
    knownModel || curatedModels.length === 0 ? defaultModel : ''

  const [modelSel, setModelSel] = useState(initialModel)
  const [modelFree, setModelFree] = useState(initialModelFree)

  function onMakeChange(v: string) {
    setMakeSel(v)
    // Pivoting make wipes the model — most models are not portable.
    setModelSel('')
    setModelFree('')
    if (v !== OTHER) setMakeFree('')
  }

  const effectiveModel =
    curatedModels.length === 0
      ? modelFree.trim()
      : modelSel === OTHER
        ? modelFree.trim()
        : modelSel

  const showMakeFreeField = makeSel === OTHER
  const showModelFreeField =
    curatedModels.length === 0 || modelSel === OTHER

  return (
    <>
      {/* ── Make ────────────────────────────────────────────────── */}
      <div>
        <label htmlFor="make-picker" className="label">
          Make <span className="text-signal">*</span>
        </label>
        <select
          id="make-picker"
          value={makeSel}
          onChange={(e) => onMakeChange(e.target.value)}
          required
          className="field"
          autoFocus
        >
          <option value="">— Select make —</option>
          {MAKES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
          <option value={OTHER}>Other / not listed</option>
        </select>
        {showMakeFreeField && (
          <input
            type="text"
            placeholder="Type the make"
            value={makeFree}
            onChange={(e) => setMakeFree(e.target.value)}
            required
            autoComplete="off"
            enterKeyHint="next"
            className="field mt-2"
          />
        )}
        {/* Hidden field that submits the resolved make */}
        <input type="hidden" name="make" value={effectiveMake} />
      </div>

      {/* ── Model ───────────────────────────────────────────────── */}
      <div>
        <label htmlFor="model-picker" className="label">
          Model <span className="text-signal">*</span>
        </label>

        {!effectiveMake && (
          <div className="field flex items-center text-mute text-sm">
            Pick a make first
          </div>
        )}

        {effectiveMake && curatedModels.length > 0 && (
          <select
            id="model-picker"
            value={modelSel}
            onChange={(e) => setModelSel(e.target.value)}
            required
            className="field"
          >
            <option value="">— Select model —</option>
            {curatedModels.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
            <option value={OTHER}>Other / not listed</option>
          </select>
        )}

        {effectiveMake && showModelFreeField && (
          <input
            type="text"
            placeholder="Type the model"
            value={modelFree}
            onChange={(e) => setModelFree(e.target.value)}
            required
            autoComplete="off"
            enterKeyHint="next"
            className={
              curatedModels.length === 0 ? 'field' : 'field mt-2'
            }
          />
        )}

        {/* Hidden field that submits the resolved model */}
        <input type="hidden" name="model" value={effectiveModel} />
      </div>
    </>
  )
}
