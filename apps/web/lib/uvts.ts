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
  status: string | null // 'verified', 'pending', etc.
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
  const verified = serviceRecords.filter(
    (s) => s.status === 'verified' || s.status === 'approved',
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
  const hasPassing = documents.some(
    (d) => d.doc_type === 'pollution_test' || d.doc_type === 'rta_passing',
  )
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
    documents.some((d) => d.doc_type === 'insurance_policy') ||
    documents.some((d) =>
      /insurance/i.test(
        (d.extracted_data?.detected_doc_type as string | null) ?? '',
      ),
    )
  if (!hasInsurance) c -= 5
  // Registration history
  const hasMulkiya = documents.some((d) => d.doc_type === 'mulkiya')
  if (!hasMulkiya) c -= 5
  // Title/legal status: tied to mulkiya for UAE
  // Market valuation data: missing in Phase 1
  c -= 5
  const hasInspection = documents.some(
    (d) => d.doc_type === 'pollution_test' || d.doc_type === 'rta_passing',
  )
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
  if (!documents.some((d) => d.doc_type === 'pollution_test')) {
    warnings.push('No RTA passing certificate on record')
  }
  if (
    !documents.some((d) => d.doc_type === 'insurance_policy') &&
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
  if (documents.some((d) => d.doc_type === 'mulkiya')) {
    strengths.push('Mulkiya on file')
  }
  if (
    documents.some((d) => d.doc_type === 'insurance_policy') ||
    ext.insurance_policy_number
  ) {
    strengths.push('Active insurance documented')
  }
  if (documents.some((d) => d.doc_type === 'pollution_test')) {
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
  if (ageYears <= 0) return vehicle.current_odometer * 12 // < 1y — extrapolate
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
