/**
 * Domain enums + literal unions used across UI + business logic.
 * Mirrors CHECK constraints in the SQL schema.
 */

export const SERVICE_TYPES = [
  'oil_change',
  'tyre_change',
  'tyre_rotation',
  'wheel_alignment',
  'brake_pads',
  'brake_fluid',
  'battery',
  'air_filter',
  'cabin_filter',
  'fuel_filter',
  'spark_plugs',
  'transmission_oil',
  'coolant',
  'ac_service',
  'ac_filter',
  'major_service',
  'minor_service',
  'inspection',
  'accident_repair',
  'detailing',
  'modification',
  'warranty_repair',
  'recall',
  'other',
] as const
export type ServiceType = (typeof SERVICE_TYPES)[number]

export const ATTESTATION_TIERS = ['owner', 'receipt', 'workshop'] as const
export type AttestationTier = (typeof ATTESTATION_TIERS)[number]

export const ACCESS_LEVELS = ['view', 'add_record', 'full'] as const
export type AccessLevel = (typeof ACCESS_LEVELS)[number]

export const VERIFICATION_TIERS = ['unverified', 'silver', 'gold'] as const
export type VerificationTier = (typeof VERIFICATION_TIERS)[number]

export const REMINDER_TYPES = [
  'oil_change',
  'tyres',
  'battery',
  'major_service',
  'registration_renewal',
  'insurance_renewal',
  'rta_passing',
  'salik_recharge',
  'warranty_expiry',
  'custom',
] as const
export type ReminderType = (typeof REMINDER_TYPES)[number]

export const EMIRATES = [
  'Abu Dhabi',
  'Dubai',
  'Sharjah',
  'Ajman',
  'Umm Al Quwain',
  'Ras Al Khaimah',
  'Fujairah',
] as const
export type Emirate = (typeof EMIRATES)[number]
