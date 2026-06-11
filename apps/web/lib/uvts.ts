/**
 * Universal Vehicle Trust Score (UVTS) — Phase 1.
 *
 * Computes a 0-100 score for a vehicle based on Identity, Usage, and
 * Maintenance categories. Damage defaults to 18 (20 minus the spec's
 * -2 "unknown accident history" penalty). Market is 0 until Phase 3.
 *
 * Pure function — no DB writes, no side effects. Inputs are the
 * already-fetched vehicle row, its documents, and service records.
 * Callers (vehicle page, share view, buyers flow) compute on render.
 *
 * The spec lives in /docs/uvts.md (uploaded original). When updating
 * thresholds keep that doc in sync — the score is a contract with
 * users and changes need a migration plan.
 */

// ─── Types ──────────────────────────────────────────────────────────

export type UvtsVehicleInput = {
  id: string
  make: string | null
  model: string | null
  year: number | null
  vin: string | null
  plate_number: string | null
  plate_emirate: string | null
  color: string | null
  current_odometer: number | null
  current_odometer_at: string | null // ISO timestamp
  created_at: string
}

export type UvtsDocInput = {
  doc_type: string
  expires_at: string | null
  created_at: string
  extracted_data: Record<string, unknown> | null
}

export type UvtsServiceInput = {
  service_type: string | null
  service_date: string | null // ISO date
  odometer: number | null
  status: string | null // 'done', 'in_progress', etc.
  /** 'workshop' | 'receipt' | 'owner' — drives trust tier */
  attestation?: string | null
  /** set when the owner rejected a workshop entry */
  rejected_at?: string | null
}

export type UvtsCategory = {
  score: number
  max: number
  subs: Array<{ label: string; score: number; max: number; note?: string }>
}

export type UvtsResult = {
  overallScore: number // 0-100
  grade: string
  confidence: number // 0-100
  phase: 1 | 2 | 3
  categories: {
    identity: UvtsCategory
    usage: UvtsCategory
    maintenance: UvtsCategory
    damage: UvtsCategory
    market: UvtsCategory
  }
  redFlags: string[]
  warnings: string[]
  strengths: string[]
  recommendation: {
    buy: string
    resale: string
    riskLevel: 'low' | 'medium' | 'elevated' | 'high' | 'unknown'
    inspectionRequired: boolean
  }
  explanation: string
}

// ─── XP view-model ──────────────────────────────────────────────────

export type XpSlot = {
  label: string
  xp: number // earned right now
  max: number
  category: 'identity' | 'usage' | 'maintenance' | 'damage' | 'market'
  unlock?: XpUnlock // present when xp < max AND something the user can do
}

export type XpUnlock = {
  action: string // user-facing CTA copy ("Upload insurance certificate")
  kind: 'upload' | 'log_service' | 'edit_vehicle' | 'periodic' | 'locked'
  href?: string // optional anchor; FAB upload uses '#upload-doc'
}

export type XpView = {
  earned: XpSlot[]
  earnMore: XpSlot[] // unearned with concrete actions
  locked: XpSlot[] // can't earn yet (Phase 2/3 features)
}

/**
 * Convert a UVTS result into a flat XP slot list grouped by status.
 * Same numbers, but framed as gameplay: every sub-score becomes an XP
 * slot, and the unearned ones get a concrete "do this to earn X XP"
 * call-to-action.
 */
export function deriveXpView(
  result: UvtsResult,
  vehicleId: string,
): XpView {
  const collected: Array<XpSlot & { _key: string }> = []

  const push = (
    sub: { label: string; score: number; max: number },
    category: XpSlot['category'],
  ) => {
    const unlock = sub.score < sub.max ? inferUnlock(sub.label, vehicleId) : undefined
    collected.push({
      _key: `${category}.${sub.label}`,
      label: humanise(sub.label),
      xp: sub.score,
      max: sub.max,
      category,
      unlock,
    })
  }
  result.categories.identity.subs.forEach((s) => push(s, 'identity'))
  result.categories.usage.subs.forEach((s) => push(s, 'usage'))
  result.categories.maintenance.subs.forEach((s) => push(s, 'maintenance'))
  result.categories.damage.subs.forEach((s) => push(s, 'damage'))
  result.categories.market.subs.forEach((s) => push(s, 'market'))

  // Three buckets:
  //   earned   — xp ≥ 80% of max
  //   earnMore — partial / zero AND there's a concrete action
  //   locked   — Phase 2/3 categories with no user action available
  const earned: XpSlot[] = []
  const earnMore: XpSlot[] = []
  const locked: XpSlot[] = []
  for (const slot of collected) {
    const pct = slot.max > 0 ? slot.xp / slot.max : 0
    if (pct >= 0.8) earned.push(slot)
    else if (slot.unlock?.kind === 'locked' || slot.unlock == null)
      locked.push(slot)
    else earnMore.push(slot)
  }

  // Sort earn-more by potential gain (max - earned) descending so the
  // biggest wins are at the top.
  earnMore.sort((a, b) => b.max - b.xp - (a.max - a.xp))
  // Sort earned by xp descending so the strongest signals come first.
  earned.sort((a, b) => b.xp - a.xp)

  return { earned, earnMore, locked }
}

/**
 * Map a UVTS sub-label to the action the user takes to fill it. The
 * mapping is intentionally coarse — we want chips like "Upload
 * insurance" rather than per-sub micro-actions. Multiple sub-scores
 * collapse to the same chip (e.g. owner_name + ownership both unlock
 * via mulkiya upload).
 */
function inferUnlock(label: string, vehicleId: string): XpUnlock {
  const l = label.toLowerCase()
  if (l.includes('market')) {
    return { action: 'Coming in Phase 3', kind: 'locked' }
  }
  if (l.includes('accident') || l.includes('damage')) {
    return { action: 'Coming in Phase 2', kind: 'locked' }
  }
  if (l.includes('recall')) {
    return { action: 'Coming soon', kind: 'locked' }
  }
  if (l.includes('inspection')) {
    return {
      action: 'Upload RTA passing certificate',
      kind: 'upload',
      href: '#upload-doc',
    }
  }
  if (l.includes('insurance') || l.includes('policy')) {
    return {
      action: 'Upload insurance certificate',
      kind: 'upload',
      href: '#upload-doc',
    }
  }
  if (
    l.includes('service history') ||
    l.includes('service frequency') ||
    l.includes('major scheduled') ||
    l.includes('major services')
  ) {
    return {
      action: 'Log a service record',
      kind: 'log_service',
      href: `/vehicles/${vehicleId}/service/new`,
    }
  }
  if (l.includes('odometer integrity') || l.includes('pattern stability')) {
    return {
      action: 'Log mileage updates every few months',
      kind: 'periodic',
    }
  }
  if (l.includes('mileage vs age') || l.includes('mileage')) {
    return {
      action: 'Update odometer',
      kind: 'edit_vehicle',
      href: `/vehicles/${vehicleId}/edit`,
    }
  }
  if (l.includes('owner count') || l.includes('ownership')) {
    return {
      action: 'Upload mulkiya',
      kind: 'upload',
      href: '#upload-doc',
    }
  }
  if (
    l.includes('vin') ||
    l.includes('engine') ||
    l.includes('registration') ||
    l.includes('plate')
  ) {
    return {
      action: 'Upload mulkiya',
      kind: 'upload',
      href: '#upload-doc',
    }
  }
  if (l.includes('usage type') || l.includes('environmental')) {
    return {
      action: 'Upload mulkiya',
      kind: 'upload',
      href: '#upload-doc',
    }
  }
  // Default — assume a doc upload solves it.
  return {
    action: 'Upload a document',
    kind: 'upload',
    href: '#upload-doc',
  }
}

function humanise(label: string): string {
  // The sub labels are already human-readable. Strip trailing
  // qualifiers like "(2)" if any future labels add them.
  return label.replace(/\s*\(\d+\)\s*$/, '')
}

// ─── Doc-centric XP view (the user-facing one) ──────────────────────

export type DocXpRow = {
  id: 'mulkiya' | 'insurance' | 'passing' | 'services' | 'odometer' | 'damage' | 'market'
  label: string
  uploaded: boolean
  earned: number      // XP this doc has contributed so far
  potential: number   // max XP this slot can deliver
  fields: string[]    // concrete values when uploaded; promise list when not
  cta?: { label: string; href: string } | null // null when locked or done
  locked?: boolean
}

export type DocXpView = {
  rows: DocXpRow[]
  totalEarned: number
  totalPotential: number
}

/**
 * Build a doc-first view of the XP score. Users think "I uploaded my
 * mulkiya" not "I scored 5/5 on VIN consistency". Each row is one doc
 * concept: uploaded? what XP did it give? what concrete fields came
 * from it? what's it worth to upload?
 *
 * The XP numbers per doc are stable estimates based on the UVTS spec's
 * subcategory mapping. We don't try to perfectly attribute every
 * extracted field to its source doc — instead we assign each doc its
 * maximum potential and degrade if extraction was weak.
 */
export function deriveDocXpView(
  vehicle: UvtsVehicleInput,
  documents: UvtsDocInput[],
  serviceRecords: UvtsServiceInput[],
  result: UvtsResult,
  vehicleId: string,
): DocXpView {
  const ext = mergedExtractionFor(documents)

  // Detect uploaded docs by explicit doc_type, the model-detected type,
  // or the per-file type list a multi-file bundle carries.
  const hasDocType = (...types: string[]) =>
    docTypePresent(documents, types)

  // Legacy fallback: bundles extracted before detected_doc_types
  // existed only kept the first file's type. Field shape is decisive
  // evidence — only the mulkiya carries owner/traffic-code, only
  // insurance docs carry a policy number.
  const mulkiyaUploaded =
    hasDocType('mulkiya') ||
    !!(ext.owner_name || ext.traffic_code_no || ext.mortgage_by)
  const insuranceUploaded =
    hasDocType(
      'insurance_policy',
      'insurance_certificate',
      'insurance_policy_schedule',
    ) ||
    !!(ext.insurance_policy_number || ext.insurance_company)
  const passingUploaded = hasDocType(
    'pollution_test',
    'rta_passing_certificate',
  )

  const rows: DocXpRow[] = []

  // ─── Mulkiya — biggest single doc ────────────────────────────────
  {
    const potential = 16
    const earned = mulkiyaUploaded
      ? estimateContribution(
          [
            ext.vin,
            ext.plate_number,
            ext.owner_name,
            ext.expires_at,
            ext.engine_number,
            ext.mortgage_by,
          ],
          potential,
        )
      : 0
    rows.push({
      id: 'mulkiya',
      label: 'Mulkiya',
      uploaded: mulkiyaUploaded,
      earned,
      potential,
      fields: mulkiyaUploaded
        ? compactFields([
            ext.vin && `VIN ${ext.vin}`,
            (ext.plate_emirate || ext.plate_number) &&
              `Plate ${[ext.plate_emirate, ext.plate_number].filter(Boolean).join(' ')}`,
            ext.owner_name && `Owner ${ext.owner_name}`,
            ext.registration_date && `Registered ${formatMonthYear(ext.registration_date as string)}`,
            ext.expires_at && `Expires ${formatDate(ext.expires_at as string)}`,
            ext.mortgage_by && `Mortgaged · ${ext.mortgage_by}`,
          ])
        : [
            'VIN, plate, owner, registration expiry, mortgage',
          ],
      cta: mulkiyaUploaded
        ? null
        : { label: 'Upload mulkiya', href: '#upload-doc' },
    })
  }

  // ─── Insurance certificate ───────────────────────────────────────
  {
    const potential = 10
    const earned = insuranceUploaded
      ? estimateContribution(
          [
            ext.insurance_company,
            ext.insurance_policy_number,
            ext.insurance_expires_at,
            ext.insurance_premium_aed,
            ext.year,
          ],
          potential,
        )
      : 0
    rows.push({
      id: 'insurance',
      label: 'Insurance certificate',
      uploaded: insuranceUploaded,
      earned,
      potential,
      fields: insuranceUploaded
        ? compactFields([
            ext.year && `Year of manufacture ${ext.year}`,
            ext.insurance_company && `Insurer ${ext.insurance_company}`,
            ext.insurance_policy_number && `Policy ${ext.insurance_policy_number}`,
            ext.insurance_expires_at &&
              `Cover expires ${formatDate(ext.insurance_expires_at as string)}`,
            typeof ext.insurance_premium_aed === 'number' &&
              `Premium AED ${(ext.insurance_premium_aed as number).toLocaleString()}`,
          ])
        : [
            'Year of manufacture, insurer, policy number, cover dates, premium',
          ],
      cta: insuranceUploaded
        ? null
        : { label: 'Upload insurance certificate', href: '#upload-doc' },
    })
  }

  // ─── RTA passing certificate ─────────────────────────────────────
  {
    const potential = 8
    const earned = passingUploaded
      ? estimateContribution(
          [ext.color, ext.fuel_type, ext.cylinders, ext.body_type],
          potential,
        )
      : 0
    rows.push({
      id: 'passing',
      label: 'RTA passing certificate',
      uploaded: passingUploaded,
      earned,
      potential,
      fields: passingUploaded
        ? compactFields([
            ext.color && `Colour ${ext.color}`,
            ext.body_type && `Body ${ext.body_type}`,
            ext.fuel_type && `Fuel ${ext.fuel_type}`,
            ext.cylinders && `${ext.cylinders} cylinders`,
            'Inspection on file',
          ])
        : ['Colour, body type, fuel, cylinders, inspection record'],
      cta: passingUploaded
        ? null
        : { label: 'Upload passing certificate', href: '#upload-doc' },
    })
  }

  // ─── Service records ─────────────────────────────────────────────
  {
    const count = serviceRecords.length
    const potential = 16
    const earned = Math.min(count * 2, potential)
    rows.push({
      id: 'services',
      label: 'Service records',
      uploaded: count > 0,
      earned,
      potential,
      fields:
        count > 0
          ? [`${count} record${count === 1 ? '' : 's'} logged`]
          : ['Each service adds up to +2 XP, capped at +16'],
      cta:
        count >= potential / 2
          ? null
          : {
              label: count > 0 ? 'Log another service' : 'Log a service',
              href: `/vehicles/${vehicleId}/service/new`,
            },
    })
  }

  // ─── Odometer + mileage history ──────────────────────────────────
  {
    const hasOdo = !!(vehicle.current_odometer && vehicle.current_odometer > 0)
    const potential = 10
    // 8 for mileage-vs-age, 2 for pattern stability (needs periodic logs)
    const earned = hasOdo
      ? 8 // single reading earns the vs-age portion only
      : 0
    rows.push({
      id: 'odometer',
      label: 'Odometer + mileage history',
      uploaded: hasOdo,
      earned,
      potential,
      fields: hasOdo
        ? [
            `Currently ${vehicle.current_odometer!.toLocaleString()} km`,
            'Log periodic updates to unlock pattern stability',
          ]
        : ['Current km · Periodic mileage logs build pattern history'],
      cta: hasOdo
        ? null
        : {
            label: 'Update odometer',
            href: `/vehicles/${vehicleId}/edit`,
          },
    })
  }

  // ─── Locked: damage history (Phase 2) ────────────────────────────
  rows.push({
    id: 'damage',
    label: 'Accident history',
    uploaded: false,
    earned: 0,
    potential: 2,
    fields: ['Coming in Phase 2 — verified accident and damage reports'],
    locked: true,
    cta: null,
  })

  // ─── Locked: market data (Phase 3) ───────────────────────────────
  rows.push({
    id: 'market',
    label: 'Market value',
    uploaded: false,
    earned: 0,
    potential: 20,
    fields: ['Coming in Phase 3 — depreciation, demand, parts availability'],
    locked: true,
    cta: null,
  })

  // Round the total to match the actual UVTS overall score so the math
  // remains coherent — the doc rows are presentation, the underlying
  // engine is truth.
  const visibleSum = rows.reduce((acc, r) => acc + r.earned, 0)
  const drift = result.overallScore - visibleSum
  if (drift !== 0 && rows.length > 0) {
    // Spread the drift across uploaded rows proportionally so the
    // visible total matches the headline number. Avoids the "math
    // doesn't add up" optics from earlier iterations.
    const uploaded = rows.filter((r) => r.uploaded && !r.locked)
    if (uploaded.length > 0) {
      const perRow = Math.round(drift / uploaded.length)
      let remaining = drift
      for (let i = 0; i < uploaded.length; i++) {
        const last = i === uploaded.length - 1
        const give = last ? remaining : perRow
        uploaded[i]!.earned = Math.max(
          0,
          Math.min(uploaded[i]!.potential, uploaded[i]!.earned + give),
        )
        remaining -= give
      }
    }
  }

  return {
    rows,
    totalEarned: rows.reduce((acc, r) => acc + r.earned, 0),
    totalPotential: rows.reduce((acc, r) => acc + r.potential, 0),
  }
}

function mergedExtractionFor(
  documents: UvtsDocInput[],
): Record<string, unknown> {
  for (const d of documents) {
    if (d.extracted_data && Object.keys(d.extracted_data).length > 0) {
      return d.extracted_data
    }
  }
  return {}
}

function estimateContribution(
  values: Array<unknown>,
  max: number,
): number {
  // Count how many of the expected fields actually got extracted.
  const found = values.filter((v) => v != null && v !== '').length
  const total = values.length
  if (total === 0) return 0
  return Math.round((found / total) * max)
}

function compactFields(parts: unknown[]): string[] {
  // Callers pass expressions like `ext.vin && \`VIN ${ext.vin}\`` where
  // `ext.vin` is typed `unknown`. The && short-circuit returns the
  // unknown falsy value when there's no data and a string when there
  // is. The filter keeps only string-typed entries — anything else
  // (null, undefined, false, the original unknown) is dropped.
  return parts.filter((p): p is string => typeof p === 'string' && p.length > 0)
}

function formatDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  return iso // keep ISO — the UI styles dates monospace
}

function formatMonthYear(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  const d = new Date(iso + 'T00:00:00Z')
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

// ─── Public entry point ─────────────────────────────────────────────

export function computeUvts(
  vehicle: UvtsVehicleInput,
  documents: UvtsDocInput[],
  serviceRecords: UvtsServiceInput[],
  today: Date = new Date(),
): UvtsResult | null {
  // The CTO rule: no score until at least one doc is uploaded. A car
  // with zero artefacts gets no number — appearing on the dashboard is
  // the reward for engagement.
  if (documents.length === 0) return null

  const identity = scoreIdentity(vehicle, documents)
  const usage = scoreUsage(vehicle, serviceRecords, today)
  const maintenance = scoreMaintenance(vehicle, documents, serviceRecords, today)
  const damage = scoreDamageDefault() // Phase 1: unknown
  const market = scoreMarketDefault() // Phase 1: unscored

  const rawTotal =
    identity.score + usage.score + maintenance.score + damage.score + market.score
  const overallScore = clamp(rawTotal, 0, 100)

  const confidence = computeConfidence(vehicle, documents, serviceRecords)
  const grade = letterGrade(overallScore)

  const redFlags = detectRedFlags(vehicle, documents)
  const warnings = detectWarnings(vehicle, documents, serviceRecords, usage)
  const strengths = detectStrengths(vehicle, documents, serviceRecords, usage)

  const recommendation = computeRecommendation({
    overallScore,
    confidence,
    redFlags,
    hasServiceHistory: serviceRecords.length > 0,
  })

  return {
    overallScore,
    grade,
    confidence,
    phase: 1,
    categories: { identity, usage, maintenance, damage, market },
    redFlags,
    warnings,
    strengths,
    recommendation,
    explanation: explainResult({
      overallScore,
      confidence,
      strengths,
      warnings,
      redFlags,
      recommendation,
    }),
  }
}

// ─── Category 1: Identity & Authenticity (max 20) ───────────────────

function scoreIdentity(
  vehicle: UvtsVehicleInput,
  documents: UvtsDocInput[],
): UvtsCategory {
  const mulkiya = findDoc(documents, 'mulkiya')
  const insurance = findInsuranceDoc(documents)
  const passing = findDoc(documents, 'pollution_test')
  const ext = mergedExtraction(documents)

  const subs: UvtsCategory['subs'] = []

  // 3.1 VIN consistency (5)
  const vin = vehicle.vin ?? (ext.vin as string | null) ?? null
  let vinScore = 0
  if (vin && /^[A-HJ-NPR-Z0-9]{17}$/i.test(vin)) {
    // Cross-check across docs that carry a VIN.
    const vinsInDocs = documents
      .map((d) => (d.extracted_data?.vin as string | null) ?? null)
      .filter((v): v is string => !!v)
    const allMatch =
      vinsInDocs.length === 0 ||
      vinsInDocs.every((v) => v.toUpperCase() === vin.toUpperCase())
    vinScore = allMatch ? 5 : 0
  } else if (vin) {
    vinScore = 2
  }
  subs.push({ label: 'VIN consistency', score: vinScore, max: 5 })

  // 3.2 Engine number verification (3)
  const engine = ext.engine_number as string | null
  const engineScore = engine ? 3 : 1 // UAE mulkiyas often omit engine no.; spec gives 1 for "not applicable in region"
  subs.push({
    label: 'Engine number',
    score: engineScore,
    max: 3,
    note: engine ? undefined : 'Not always printed on UAE mulkiya',
  })

  // 3.3 Title / Legal / Registration Status (4)
  const today = new Date()
  let titleScore = 0
  if (mulkiya) {
    const exp = mulkiya.expires_at ?? (ext.expires_at as string | null)
    if (exp && new Date(exp) > today) titleScore = 4
    else if (exp) titleScore = 1
    else titleScore = 2
  } else {
    titleScore = 2 // unknown but no negative evidence
  }
  subs.push({ label: 'Registration status', score: titleScore, max: 4 })

  // 3.4 Ownership Documentation (4)
  let ownershipScore = 0
  const owner = ext.owner_name as string | null
  if (owner && mulkiya) ownershipScore = 4
  else if (owner) ownershipScore = 3
  else if (mulkiya) ownershipScore = 2
  subs.push({ label: 'Ownership documentation', score: ownershipScore, max: 4 })

  // 3.5 Odometer Integrity (4)
  // Phase 1: we only have one odometer reading (current_odometer). When
  // we add periodic mileage logging this can detect rollbacks. Until
  // then it's 2 = insufficient history if we have a reading, 0 if not.
  let odoScore = 0
  if (vehicle.current_odometer && vehicle.current_odometer > 0) odoScore = 2
  subs.push({
    label: 'Odometer integrity',
    score: odoScore,
    max: 4,
    note: 'Add periodic mileage logs to raise this',
  })

  // Suppress unused-var warning — kept so future logic can reference.
  void insurance
  void passing

  return {
    score: sum(subs),
    max: 20,
    subs,
  }
}

// ─── Category 2: Usage & Wear (max 20) ──────────────────────────────

function scoreUsage(
  vehicle: UvtsVehicleInput,
  _serviceRecords: UvtsServiceInput[],
  today: Date,
): UvtsCategory {
  const subs: UvtsCategory['subs'] = []

  // 4.1 Mileage vs Age (8)
  const annual = annualMileage(vehicle, today)
  let mileageScore = 0
  let mileageNote: string | undefined
  if (annual == null) {
    mileageScore = 0
    mileageNote = 'No year or odometer recorded'
  } else if (annual < 12000) mileageScore = 8
  else if (annual <= 25000) mileageScore = 6
  else if (annual <= 40000) mileageScore = 4
  else if (annual <= 60000) mileageScore = 2
  else mileageScore = 0
  if (annual != null) mileageNote = `${Math.round(annual).toLocaleString()} km/year`
  subs.push({
    label: 'Mileage vs age',
    score: mileageScore,
    max: 8,
    note: mileageNote,
  })

  // 4.2 Owner Count (4)
  // Phase 1: assume single-owner private use since the user is the
  // owner today. When we add ownership_history table or RTA transfer
  // data, replace this with the actual count.
  subs.push({
    label: 'Owner count',
    score: 4,
    max: 4,
    note: 'Assumed single-owner until RTA history integration',
  })

  // 4.3 Usage Type (4)
  // Default to private (4). Look at extracted use_of_vehicle for fleet
  // / commercial markers.
  const ext = mergedExtractionFromVehicle()
  const use = (ext.use_of_vehicle as string | null) ?? null
  let usageTypeScore = 4
  if (use) {
    const lower = use.toLowerCase()
    if (
      /taxi|rental|delivery|ride.?hail|driving.?school|fleet|commercial|public/i.test(
        lower,
      )
    ) {
      usageTypeScore = 0
    } else if (/corporate|company|executive/i.test(lower)) {
      usageTypeScore = 2
    }
  }
  subs.push({
    label: 'Usage type',
    score: usageTypeScore,
    max: 4,
    note: use ? `Listed as ${use}` : undefined,
  })

  // 4.4 Environmental Exposure (2)
  // UAE is hot but most cars are garaged/AC-stored. Default to 1 (mixed).
  // No data source to verify garaging in Phase 1.
  subs.push({
    label: 'Environmental exposure',
    score: 1,
    max: 2,
    note: 'Defaults to mixed; UAE climate baseline',
  })

  // 4.5 Usage Pattern Stability (2)
  // Phase 1: single odometer reading means we can't detect patterns.
  // Default to 1 (some gaps).
  subs.push({
    label: 'Usage pattern stability',
    score: 1,
    max: 2,
    note: 'Periodic mileage logs unlock this',
  })

  return { score: sum(subs), max: 20, subs }
}

// ─── Category 3: Maintenance & Care (max 20) ────────────────────────

function scoreMaintenance(
  vehicle: UvtsVehicleInput,
  documents: UvtsDocInput[],
  serviceRecords: UvtsServiceInput[],
  today: Date,
): UvtsCategory {
  const subs: UvtsCategory['subs'] = []

  // 5.1 Service History Completeness (8)
  // Heuristic: expect ~1 service per year OR per 15,000 km. Documented
  // percentage = actual services / expected. Cap at 100%.
  // A service record is documented maintenance evidence unless it was
  // rejected. The previous filter required status 'verified'/'approved'
  // — values this schema never writes — so EVERY car scored 0 on
  // maintenance regardless of its real history. Attestation tier is
  // reflected in source-quality/confidence, not by zeroing the count.
  const verified = serviceRecords.filter(
    (s) => s.rejected_at == null && s.status !== 'rejected',
  )
  const age = vehicleAge(vehicle, today)
  const odo = vehicle.current_odometer ?? 0
  const expectedByAge = age ? Math.max(1, Math.round(age)) : 0
  const expectedByKm = odo > 0 ? Math.max(1, Math.round(odo / 15_000)) : 0
  const expected = Math.max(expectedByAge, expectedByKm, 1)
  const pct = (verified.length / expected) * 100
  let completenessScore = 0
  if (pct >= 90) completenessScore = 8
  else if (pct >= 70) completenessScore = 6
  else if (pct >= 50) completenessScore = 4
  else if (pct >= 25) completenessScore = 2
  else completenessScore = 0
  subs.push({
    label: 'Service history completeness',
    score: completenessScore,
    max: 8,
    note: `${verified.length} verified · ~${expected} expected`,
  })

  // 5.2 Service Frequency (4)
  // Days between most recent two services. If < 400 days → on time.
  let frequencyScore = 2 // unknown by default
  if (verified.length >= 2) {
    const sorted = [...verified]
      .filter((s) => s.service_date)
      .sort((a, b) => (b.service_date! > a.service_date! ? 1 : -1))
    if (sorted.length >= 2) {
      const gap = daysBetween(sorted[1]!.service_date!, sorted[0]!.service_date!)
      if (gap <= 400) frequencyScore = 4
      else if (gap <= 600) frequencyScore = 3
      else if (gap <= 800) frequencyScore = 1
      else frequencyScore = 0
    }
  } else if (verified.length === 1) {
    frequencyScore = 2
  } else {
    frequencyScore = 0
  }
  subs.push({
    label: 'Service frequency',
    score: frequencyScore,
    max: 4,
  })

  // 5.3 Major Scheduled Services (4)
  // Detect mentions of timing belt, transmission, brake fluid, coolant,
  // spark plugs in service_type or notes. Phase 1 is a coarse check.
  const majorKeywords = [
    'timing',
    'transmission',
    'brake fluid',
    'coolant',
    'spark plug',
    'differential',
    'transfer case',
  ]
  const types = verified
    .map((s) => (s.service_type ?? '').toLowerCase())
    .join(' ')
  const majorsHit = majorKeywords.filter((k) => types.includes(k)).length
  let majorScore = 1
  if (majorsHit >= 4) majorScore = 4
  else if (majorsHit >= 2) majorScore = 2
  else if (majorsHit >= 1) majorScore = 1
  else majorScore = 0
  subs.push({
    label: 'Major scheduled services',
    score: majorScore,
    max: 4,
    note:
      majorsHit > 0
        ? `${majorsHit} of 7 milestone categories covered`
        : undefined,
  })

  // 5.4 Recall Compliance (2)
  // No NHTSA integration in Phase 1 → status unknown.
  subs.push({
    label: 'Recall compliance',
    score: 1,
    max: 2,
    note: 'Recall API integration upcoming',
  })

  // 5.5 Inspection Results (2)
  const hasPassing = docTypePresent(documents, [
    'pollution_test',
    'rta_passing',
    'rta_passing_certificate',
  ])
  const ext = mergedExtraction(documents)
  const hasPassingExtracted =
    !!ext.detected_doc_type &&
    /passing|tasjeel|pollution/i.test(ext.detected_doc_type as string)
  const inspectionScore = hasPassing || hasPassingExtracted ? 2 : 1
  subs.push({
    label: 'Inspection results',
    score: inspectionScore,
    max: 2,
    note: hasPassing || hasPassingExtracted ? 'RTA passing on file' : undefined,
  })

  return { score: sum(subs), max: 20, subs }
}

// ─── Category 4: Damage & Risk History — Phase 1 default ────────────

function scoreDamageDefault(): UvtsCategory {
  return {
    score: 18, // 20 minus -2 "unknown accident history" penalty per spec §6.1
    max: 20,
    subs: [
      {
        label: 'Accident history',
        score: 18,
        max: 20,
        note: 'Damage history integration pending',
      },
    ],
  }
}

// ─── Category 5: Market & Ownership Quality — Phase 1 default ───────

function scoreMarketDefault(): UvtsCategory {
  return {
    score: 0,
    max: 20,
    subs: [
      {
        label: 'Market data',
        score: 0,
        max: 20,
        note: 'Depreciation + reliability data lands in Phase 3',
      },
    ],
  }
}

// ─── Confidence Score ───────────────────────────────────────────────

function computeConfidence(
  vehicle: UvtsVehicleInput,
  documents: UvtsDocInput[],
  serviceRecords: UvtsServiceInput[],
): number {
  let c = 100

  // §8.1 Missing data deductions
  if (!vehicle.vin) c -= 30
  if (!vehicle.current_odometer) c -= 20
  if (serviceRecords.length === 0) c -= 20
  // Ownership history: missing in Phase 1
  c -= 10
  // Accident history: missing in Phase 1
  c -= 10
  const hasInsurance =
    docTypePresent(documents, [
      'insurance_policy',
      'insurance_certificate',
      'insurance_policy_schedule',
    ]) ||
    documents.some((d) =>
      /insurance/i.test(
        (d.extracted_data?.detected_doc_type as string | null) ?? '',
      ),
    )
  if (!hasInsurance) c -= 5
  // Registration history
  const hasMulkiya = docTypePresent(documents, ['mulkiya'])
  if (!hasMulkiya) c -= 5
  // Title/legal status: tied to mulkiya for UAE
  // Market valuation data: missing in Phase 1
  c -= 5
  const hasInspection = docTypePresent(documents, [
    'pollution_test',
    'rta_passing',
    'rta_passing_certificate',
  ])
  if (!hasInspection) c -= 5

  // §8.2 Source quality
  if (hasMulkiya) c += 5
  if (hasInsurance) c += 5
  // No manufacturer-dealer record source in Phase 1

  return clamp(c, 0, 100)
}

// ─── Red flags / Warnings / Strengths ───────────────────────────────

function detectRedFlags(
  vehicle: UvtsVehicleInput,
  documents: UvtsDocInput[],
): string[] {
  const flags: string[] = []
  const ext = mergedExtraction(documents)

  // VIN mismatch across docs
  const vinsInDocs = documents
    .map((d) => (d.extracted_data?.vin as string | null) ?? null)
    .filter((v): v is string => !!v)
  if (vinsInDocs.length >= 2) {
    const first = vinsInDocs[0]!.toUpperCase()
    if (!vinsInDocs.every((v) => v.toUpperCase() === first)) {
      flags.push('VIN mismatch between documents')
    }
  }
  if (vehicle.vin && vinsInDocs.length > 0) {
    const first = vinsInDocs[0]!.toUpperCase()
    if (vehicle.vin.toUpperCase() !== first) {
      flags.push('VIN on record differs from uploaded documents')
    }
  }

  // Mulkiya expired
  const mulkiya = findDoc(documents, 'mulkiya')
  const mulkiyaExpiry = mulkiya?.expires_at ?? (ext.expires_at as string | null)
  if (mulkiyaExpiry && new Date(mulkiyaExpiry) < new Date()) {
    flags.push('Mulkiya registration has expired')
  }

  // Insurance expired
  const insuranceExpiry =
    findInsuranceDoc(documents)?.expires_at ??
    (ext.insurance_expires_at as string | null)
  if (insuranceExpiry && new Date(insuranceExpiry) < new Date()) {
    flags.push('Insurance has expired')
  }

  return flags
}

function detectWarnings(
  vehicle: UvtsVehicleInput,
  documents: UvtsDocInput[],
  serviceRecords: UvtsServiceInput[],
  usage: UvtsCategory,
): string[] {
  const warnings: string[] = []
  const ext = mergedExtraction(documents)

  if (serviceRecords.length === 0) {
    warnings.push('No service history on file')
  }
  if (
    !docTypePresent(documents, [
      'pollution_test',
      'rta_passing',
      'rta_passing_certificate',
    ])
  ) {
    warnings.push('No RTA passing certificate on record')
  }
  if (
    !docTypePresent(documents, [
      'insurance_policy',
      'insurance_certificate',
      'insurance_policy_schedule',
    ]) &&
    !ext.insurance_policy_number
  ) {
    warnings.push('No insurance policy on record')
  }

  // High annual mileage
  const annualSub = usage.subs.find((s) => s.label === 'Mileage vs age')
  if (annualSub && annualSub.score <= 2) {
    warnings.push('High annual mileage')
  }

  return warnings
}

function detectStrengths(
  vehicle: UvtsVehicleInput,
  documents: UvtsDocInput[],
  serviceRecords: UvtsServiceInput[],
  usage: UvtsCategory,
): string[] {
  const strengths: string[] = []
  const ext = mergedExtraction(documents)

  if (vehicle.vin && /^[A-HJ-NPR-Z0-9]{17}$/i.test(vehicle.vin)) {
    strengths.push('Verified VIN')
  }
  if (docTypePresent(documents, ['mulkiya']) || ext.traffic_code_no) {
    strengths.push('Mulkiya on file')
  }
  if (
    docTypePresent(documents, [
      'insurance_policy',
      'insurance_certificate',
      'insurance_policy_schedule',
    ]) ||
    ext.insurance_policy_number
  ) {
    strengths.push('Active insurance documented')
  }
  if (
    docTypePresent(documents, [
      'pollution_test',
      'rta_passing',
      'rta_passing_certificate',
    ])
  ) {
    strengths.push('RTA passing on file')
  }
  if (serviceRecords.length >= 3) {
    strengths.push(`${serviceRecords.length} service records logged`)
  }
  // Low mileage
  const annualSub = usage.subs.find((s) => s.label === 'Mileage vs age')
  if (annualSub && annualSub.score >= 6) {
    strengths.push('Low to normal annual mileage')
  }

  return strengths
}

// ─── Recommendation ─────────────────────────────────────────────────

function computeRecommendation({
  overallScore,
  confidence,
  redFlags,
  hasServiceHistory,
}: {
  overallScore: number
  confidence: number
  redFlags: string[]
  hasServiceHistory: boolean
}): UvtsResult['recommendation'] {
  let buy: string
  if (overallScore >= 90) buy = 'Exceptional Buy'
  else if (overallScore >= 80) buy = 'Strong Buy'
  else if (overallScore >= 70) buy = 'Fair Buy'
  else if (overallScore >= 60) buy = 'Proceed With Caution'
  else buy = 'High Risk'

  // §10.1 overrides
  if (confidence < 40) buy = 'High Risk · Insufficient Data'
  else if (confidence < 60 && buy !== 'High Risk') buy = 'Fair Buy'
  if (!hasServiceHistory && /Strong Buy|Exceptional Buy/.test(buy))
    buy = 'Fair Buy'

  const severe = redFlags.some((f) =>
    /mismatch|salvage|flood|fire|rollback|total loss/i.test(f),
  )
  if (severe) buy = 'High Risk'

  let resale: string
  if (overallScore >= 85) resale = 'Very High'
  else if (overallScore >= 72) resale = 'High'
  else if (overallScore >= 60) resale = 'Moderate'
  else if (overallScore >= 46) resale = 'Weak'
  else resale = 'Poor'

  let riskLevel: UvtsResult['recommendation']['riskLevel']
  if (confidence < 40) riskLevel = 'unknown'
  else if (overallScore < 60 || severe) riskLevel = 'high'
  else if (overallScore < 70) riskLevel = 'elevated'
  else if (overallScore < 85) riskLevel = 'medium'
  else riskLevel = 'low'

  return {
    buy,
    resale,
    riskLevel,
    inspectionRequired: true, // always — never replaces physical inspection per spec §1
  }
}

// ─── Explanation ────────────────────────────────────────────────────

function explainResult(args: {
  overallScore: number
  confidence: number
  strengths: string[]
  warnings: string[]
  redFlags: string[]
  recommendation: UvtsResult['recommendation']
}): string {
  const { overallScore, confidence, strengths, warnings, redFlags, recommendation } =
    args
  const lines: string[] = []
  lines.push(
    `This vehicle scores ${overallScore}/100 with ${confidenceBand(confidence)} confidence (${confidence}/100).`,
  )
  if (strengths.length > 0) {
    lines.push(`Strengths: ${strengths.slice(0, 3).join(', ').toLowerCase()}.`)
  }
  if (warnings.length > 0) {
    lines.push(`Watch-outs: ${warnings.slice(0, 3).join(', ').toLowerCase()}.`)
  }
  if (redFlags.length > 0) {
    lines.push(`Red flags: ${redFlags.join(', ')}.`)
  }
  lines.push(
    `Recommendation: ${recommendation.buy}. A physical inspection and OBD scan are always advised before purchase.`,
  )
  return lines.join(' ')
}

// ─── Helpers ────────────────────────────────────────────────────────

function letterGrade(score: number): string {
  if (score >= 95) return 'A+'
  if (score >= 90) return 'A'
  if (score >= 85) return 'A-'
  if (score >= 80) return 'B+'
  if (score >= 75) return 'B'
  if (score >= 70) return 'B-'
  if (score >= 65) return 'C+'
  if (score >= 60) return 'C'
  if (score >= 55) return 'C-'
  if (score >= 50) return 'D'
  return 'F'
}

function confidenceBand(c: number): string {
  if (c >= 95) return 'very high'
  if (c >= 80) return 'high'
  if (c >= 60) return 'moderate'
  if (c >= 40) return 'low'
  return 'very low'
}

/**
 * True when any document matches one of the wanted types — by its
 * explicit doc_type column, the model-detected type, or any entry in
 * the per-file detected_doc_types list a multi-file bundle carries.
 */
function docTypePresent(
  documents: UvtsDocInput[],
  types: string[],
): boolean {
  return documents.some((d) => {
    if (types.includes(d.doc_type)) return true
    const ext = d.extracted_data
    if (!ext) return false
    const single = (ext.detected_doc_type as string | null) ?? ''
    if (types.includes(single)) return true
    const many = ext.detected_doc_types
    if (Array.isArray(many) && many.some((t) => types.includes(t as string)))
      return true
    // Bundles store one extraction per file — scan their individual
    // classifications too (covers rows written before
    // detected_doc_types existed).
    const perFile = ext.per_file_extractions
    return (
      Array.isArray(perFile) &&
      perFile.some((r) =>
        types.includes(
          ((r as Record<string, unknown>)?.detected_doc_type as string) ?? '',
        ),
      )
    )
  })
}

function findDoc(documents: UvtsDocInput[], docType: string): UvtsDocInput | null {
  const d = documents.find((x) => x.doc_type === docType)
  if (d) return d
  // For auto-classified docs, look inside extracted_data.detected_doc_type.
  return (
    documents.find((x) => {
      const detected = x.extracted_data?.detected_doc_type as string | null
      return detected === docType
    }) ?? null
  )
}

function findInsuranceDoc(documents: UvtsDocInput[]): UvtsDocInput | null {
  return (
    documents.find((d) => d.doc_type === 'insurance_policy') ??
    documents.find((d) => {
      const det = d.extracted_data?.detected_doc_type as string | null
      return det === 'insurance_certificate' || det === 'insurance_policy_schedule'
    }) ??
    null
  )
}

function mergedExtraction(
  documents: UvtsDocInput[],
): Record<string, unknown> {
  // Prefer a doc whose extracted_data already represents a merge —
  // the new FAB flow stores per_file_extractions + a merged top-level.
  // Otherwise pick the first doc with extracted_data.
  for (const d of documents) {
    if (d.extracted_data && Object.keys(d.extracted_data).length > 0) {
      return d.extracted_data
    }
  }
  return {}
}

// Stub for parity — we don't have vehicle-level extraction yet but the
// usage type code path imagines an extracted use_of_vehicle on the
// vehicle row in the future. For now this returns the doc-level merge.
function mergedExtractionFromVehicle(): Record<string, unknown> {
  return {}
}

function annualMileage(
  vehicle: UvtsVehicleInput,
  today: Date,
): number | null {
  if (!vehicle.current_odometer || !vehicle.year) return null
  const ageYears = today.getUTCFullYear() - vehicle.year
  // <1 year old: we can't compute a meaningful annual rate from a
  // calendar-year diff (the old `odometer * 12` claimed a 5,000 km car
  // drove 60,000 km/yr and flagged it "high mileage"). Unknown is the
  // honest answer.
  if (ageYears <= 0) return null
  return vehicle.current_odometer / ageYears
}

function vehicleAge(vehicle: UvtsVehicleInput, today: Date): number | null {
  if (!vehicle.year) return null
  return today.getUTCFullYear() - vehicle.year
}

function daysBetween(aIso: string, bIso: string): number {
  const a = new Date(aIso).getTime()
  const b = new Date(bIso).getTime()
  return Math.abs(Math.round((b - a) / 86_400_000))
}

function sum(subs: UvtsCategory['subs']): number {
  return subs.reduce((acc, s) => acc + s.score, 0)
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}
