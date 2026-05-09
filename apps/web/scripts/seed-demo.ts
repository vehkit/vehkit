/**
 * seed-demo.ts — Populate Vehkit with realistic UAE demo data for the
 * funding round. Idempotent: cleans up any prior demo data tagged with
 * @demo.vehkit.dev email domain before re-seeding.
 *
 * Run:
 *   pnpm tsx apps/web/scripts/seed-demo.ts
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Reads from apps/web/.env.local automatically if present.
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import path from 'node:path'

config({ path: path.resolve(process.cwd(), 'apps/web/.env.local') })
config({ path: path.resolve(process.cwd(), '.env.local') })
config()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const sb = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const DEMO_DOMAIN = '@demo.vehkit.dev'

// Optional: a real (non-demo) email to attach as the ASM showpiece owner.
// Set SEED_SHOWCASE_EMAIL=shamirmoossadxb@gmail.com (or whatever) so that
// when this person signs in, /workshop lands on the boosted ASM dashboard.
const SHOWCASE_EMAIL = process.env.SEED_SHOWCASE_EMAIL ?? 'shamirmoossadxb@gmail.com'

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

const HERO_PHOTOS = [
  'https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?w=1200&q=80', // toyota land cruiser white
  'https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=1200&q=80', // sedan grey
  'https://images.unsplash.com/photo-1542362567-b07e54358753?w=1200&q=80', // bmw silver
  'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=1200&q=80', // mustang red
  'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1200&q=80', // black coupe
  'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=1200&q=80', // suv beige
  'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=1200&q=80', // suv white
  'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=1200&q=80', // mercedes
  'https://images.unsplash.com/photo-1544829099-b9a0c07fad1a?w=1200&q=80', // sedan blue
  'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=1200&q=80', // suv white
]

const WORKSHOPS_DATA = [
  {
    name: 'ASM German Auto Garage',
    emirate: 'Dubai',
    address: 'Al Quoz Industrial Area 4, Dubai',
    phone: '+971 4 322 1455',
    email: 'info@asmgerman.ae',
    targetTier: 'gold' as const,
  },
  {
    name: 'Al Quoz Auto Care',
    emirate: 'Dubai',
    address: 'Al Quoz 3, Sheikh Zayed Road service road',
    phone: '+971 4 333 6789',
    email: 'service@alquozauto.ae',
    targetTier: 'silver' as const,
  },
  {
    name: 'Sharjah Service Centre',
    emirate: 'Sharjah',
    address: 'Industrial Area 13, Sharjah',
    phone: '+971 6 553 2010',
    email: 'help@sharjahservice.ae',
    targetTier: 'silver' as const,
  },
  {
    name: 'Abu Dhabi Premium Motors',
    emirate: 'Abu Dhabi',
    address: 'Mussafah ICAD 1, Abu Dhabi',
    phone: '+971 2 559 3322',
    email: 'concierge@adpremium.ae',
    targetTier: 'gold' as const,
  },
  {
    name: 'Mussafah Mechanics',
    emirate: 'Abu Dhabi',
    address: 'Mussafah Industrial Area, Abu Dhabi',
    phone: '+971 2 555 7711',
    email: 'team@mussafahmech.ae',
    targetTier: 'silver' as const,
  },
  {
    name: 'Ras Al Khaimah Motors',
    emirate: 'Ras Al Khaimah',
    address: 'Al Jazeera Al Hamra, RAK',
    phone: '+971 7 234 5566',
    email: 'rakmotors@example.ae',
    targetTier: 'unverified' as const,
  },
  {
    name: 'Ajman Auto Hub',
    emirate: 'Ajman',
    address: 'New Industrial Area, Ajman',
    phone: '+971 6 712 0099',
    email: 'hub@ajmanauto.ae',
    targetTier: 'silver' as const,
  },
  {
    name: 'Fujairah Quick Lube',
    emirate: 'Fujairah',
    address: 'Al Faseel Road, Fujairah',
    phone: '+971 9 222 1100',
    email: 'fuj@quicklube.ae',
    targetTier: 'unverified' as const,
  },
]

const OWNERS_DATA = [
  { full_name: 'Ahmed Al-Mansoori', preferred_language: 'ar' },
  { full_name: 'Layla Hassan', preferred_language: 'en' },
  { full_name: 'Omar Sultan', preferred_language: 'ar' },
  { full_name: 'Priya Sharma', preferred_language: 'en' },
  { full_name: 'Karthik Iyer', preferred_language: 'en' },
  { full_name: 'Fatima Al-Hashimi', preferred_language: 'ar' },
  { full_name: 'Daniel Reynolds', preferred_language: 'en' },
  { full_name: 'Saeed Bin Rashid', preferred_language: 'ar' },
  { full_name: 'Aisha Mohammed', preferred_language: 'ar' },
  { full_name: 'Vikram Kapoor', preferred_language: 'en' },
  { full_name: 'Mohammed Al-Awadhi', preferred_language: 'ar' },
  { full_name: 'Jennifer Walsh', preferred_language: 'en' },
]

const WORKSHOP_OWNERS_DATA = [
  { full_name: 'Hans Müller' }, // ASM German
  { full_name: 'Khalid Al-Marri' }, // Al Quoz
  { full_name: 'Rashid Al-Shamsi' }, // Sharjah Service
  { full_name: 'Stefan Becker' }, // AD Premium
  { full_name: 'Yousef Hamdan' }, // Mussafah
  { full_name: 'Suleiman Al-Nuaimi' }, // RAK Motors
  { full_name: 'Hamad Al-Naqbi' }, // Ajman Hub
  { full_name: 'Ali Al-Sharqi' }, // Fujairah Quick Lube
]

// Cars: a realistic UAE mix.
const VEHICLES_DATA = [
  { make: 'Toyota', model: 'Land Cruiser', year: 2022, color: 'White', plate_emirate: 'Dubai', plate_number: 'A 12345', current_odometer: 38_500, fuel_type: 'petrol', nickname: null },
  { make: 'Toyota', model: 'Camry', year: 2021, color: 'Silver', plate_emirate: 'Dubai', plate_number: 'F 88123', current_odometer: 67_200, fuel_type: 'petrol', nickname: 'Daily Driver' },
  { make: 'Toyota', model: 'Yaris', year: 2019, color: 'White', plate_emirate: 'Dubai', plate_number: 'L 22210', current_odometer: 92_400, fuel_type: 'petrol', nickname: null },
  { make: 'Toyota', model: 'Hilux', year: 2020, color: 'Pearl White', plate_emirate: 'Abu Dhabi', plate_number: '12 34567', current_odometer: 110_500, fuel_type: 'diesel', nickname: 'The Workhorse' },
  { make: 'Nissan', model: 'Patrol', year: 2023, color: 'Black', plate_emirate: 'Dubai', plate_number: 'P 99099', current_odometer: 14_800, fuel_type: 'petrol', nickname: 'Patrol' },
  { make: 'Nissan', model: 'Sunny', year: 2018, color: 'Silver', plate_emirate: 'Sharjah', plate_number: '1 33445', current_odometer: 132_000, fuel_type: 'petrol', nickname: null },
  { make: 'Nissan', model: 'X-Trail', year: 2021, color: 'Grey', plate_emirate: 'Dubai', plate_number: 'M 56432', current_odometer: 54_300, fuel_type: 'petrol', nickname: 'Family SUV' },
  { make: 'Lexus', model: 'LX 600', year: 2023, color: 'Sonic Silver', plate_emirate: 'Abu Dhabi', plate_number: '5 12121', current_odometer: 9_200, fuel_type: 'petrol', nickname: null },
  { make: 'Lexus', model: 'RX 350', year: 2022, color: 'Dark Blue', plate_emirate: 'Dubai', plate_number: 'R 44321', current_odometer: 28_900, fuel_type: 'petrol', nickname: null },
  { make: 'Lexus', model: 'ES 350', year: 2020, color: 'White Pearl', plate_emirate: 'Dubai', plate_number: 'D 19876', current_odometer: 78_400, fuel_type: 'petrol', nickname: null },
  { make: 'BMW', model: 'X5', year: 2021, color: 'Alpine White', plate_emirate: 'Dubai', plate_number: 'Q 32145', current_odometer: 48_700, fuel_type: 'petrol', nickname: 'White Bear' },
  { make: 'BMW', model: '5 Series', year: 2022, color: 'Black Sapphire', plate_emirate: 'Dubai', plate_number: 'S 87654', current_odometer: 32_100, fuel_type: 'petrol', nickname: null },
  { make: 'Mercedes-Benz', model: 'G 63 AMG', year: 2023, color: 'Obsidian Black', plate_emirate: 'Dubai', plate_number: 'AA 7', current_odometer: 12_500, fuel_type: 'petrol', nickname: 'G-Wagen' },
  { make: 'Mercedes-Benz', model: 'C 200', year: 2020, color: 'Iridium Silver', plate_emirate: 'Abu Dhabi', plate_number: '17 22113', current_odometer: 71_300, fuel_type: 'petrol', nickname: null },
  { make: 'Honda', model: 'Civic', year: 2019, color: 'Modern Steel', plate_emirate: 'Sharjah', plate_number: '2 78901', current_odometer: 98_200, fuel_type: 'petrol', nickname: null },
  { make: 'Honda', model: 'CR-V', year: 2021, color: 'Lunar Silver', plate_emirate: 'Dubai', plate_number: 'N 67890', current_odometer: 51_800, fuel_type: 'petrol', nickname: 'Family Car' },
  { make: 'Hyundai', model: 'Sonata', year: 2020, color: 'Phantom Black', plate_emirate: 'Dubai', plate_number: 'V 11223', current_odometer: 87_500, fuel_type: 'petrol', nickname: null },
  { make: 'Hyundai', model: 'Elantra', year: 2018, color: 'Polar White', plate_emirate: 'Ajman', plate_number: 'C 23456', current_odometer: 145_300, fuel_type: 'petrol', nickname: null },
  { make: 'Ford', model: 'Mustang GT', year: 2021, color: 'Race Red', plate_emirate: 'Dubai', plate_number: 'O 5555', current_odometer: 22_900, fuel_type: 'petrol', nickname: 'The Pony' },
  { make: 'Ford', model: 'F-150 Raptor', year: 2022, color: 'Velocity Blue', plate_emirate: 'Abu Dhabi', plate_number: '50 99887', current_odometer: 18_700, fuel_type: 'petrol', nickname: null },
  { make: 'Kia', model: 'Sportage', year: 2022, color: 'Snow White Pearl', plate_emirate: 'Dubai', plate_number: 'I 67432', current_odometer: 27_600, fuel_type: 'petrol', nickname: null },
  { make: 'Kia', model: 'Telluride', year: 2023, color: 'Wolf Grey', plate_emirate: 'Dubai', plate_number: 'T 12321', current_odometer: 11_400, fuel_type: 'petrol', nickname: null },
  { make: 'Mitsubishi', model: 'Pajero', year: 2019, color: 'Bronze', plate_emirate: 'Sharjah', plate_number: '3 43234', current_odometer: 122_500, fuel_type: 'petrol', nickname: null },
  { make: 'Mitsubishi', model: 'L200', year: 2020, color: 'White', plate_emirate: 'Ras Al Khaimah', plate_number: '7 11189', current_odometer: 95_700, fuel_type: 'diesel', nickname: 'Worktruck' },
  { make: 'Toyota', model: 'Prado', year: 2022, color: 'Crystal Pearl', plate_emirate: 'Dubai', plate_number: 'B 76543', current_odometer: 31_400, fuel_type: 'petrol', nickname: null },
  { make: 'Nissan', model: 'Altima', year: 2021, color: 'Pearl White', plate_emirate: 'Dubai', plate_number: 'U 33445', current_odometer: 56_700, fuel_type: 'petrol', nickname: null },
  { make: 'Lexus', model: 'NX 350h', year: 2023, color: 'Caviar', plate_emirate: 'Abu Dhabi', plate_number: '1 88991', current_odometer: 8_900, fuel_type: 'hybrid', nickname: null },
  { make: 'Volkswagen', model: 'Tiguan', year: 2020, color: 'Pure White', plate_emirate: 'Dubai', plate_number: 'X 23232', current_odometer: 78_200, fuel_type: 'petrol', nickname: null },
  { make: 'Audi', model: 'Q5', year: 2021, color: 'Glacier White', plate_emirate: 'Dubai', plate_number: 'H 54321', current_odometer: 41_500, fuel_type: 'petrol', nickname: 'White Q' },
  { make: 'Mazda', model: 'CX-5', year: 2020, color: 'Soul Red', plate_emirate: 'Dubai', plate_number: 'E 90876', current_odometer: 64_200, fuel_type: 'petrol', nickname: null },
]

const SERVICE_TYPES = [
  'oil_change',
  'tyre_rotation',
  'brake_pads',
  'battery',
  'major_service',
  'ac_filter',
  'spark_plugs',
  'brake_fluid',
  'coolant',
  'wheel_alignment',
] as const

const COST_RANGES: Record<string, [number, number]> = {
  oil_change: [180, 450],
  tyre_rotation: [80, 180],
  brake_pads: [400, 1200],
  battery: [350, 900],
  major_service: [1200, 3500],
  ac_filter: [120, 280],
  spark_plugs: [350, 800],
  brake_fluid: [180, 320],
  coolant: [150, 280],
  wheel_alignment: [120, 250],
}

const REVIEW_COMMENTS = [
  'Job done well. Took longer than promised but quality is solid.',
  'Fair price, transparent quote. Would come back.',
  'Excellent work. Explained everything they were doing.',
  'Quick turnaround. Car drives like new.',
  'Honest mechanics — they showed me the worn parts before replacing.',
  'Polite team, clean facility. Slightly above average pricing.',
  'They fixed the problem on the first try. Saved me a second visit.',
  null, // some reviews comment-less
  'Verified entry on Vehkit was a nice touch — feels official.',
  'Used to go elsewhere, switched to these guys. Worth it.',
  null,
  'Fast oil change, no upselling. Exactly what I wanted.',
  'Diagnosed an issue another shop missed. Saved me money.',
  'Standard service, no complaints. Will return.',
  'Slightly pricey but I trust them with my car.',
  null,
  'Great communication throughout. Texted me updates.',
  'Workshop is well-organized and I felt my car was in good hands.',
]

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

function pickN<T>(arr: readonly T[], n: number): T[] {
  const copy = [...arr]
  const out: T[] = []
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(Math.random() * copy.length)
    out.push(copy.splice(idx, 1)[0]!)
  }
  return out
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function daysAgo(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

async function cleanupDemo() {
  console.log('→ cleaning prior demo data…')
  const { data: demoUsers } = await sb.auth.admin.listUsers({ perPage: 1000 })
  const demoIds =
    demoUsers?.users
      ?.filter((u) => u.email?.endsWith(DEMO_DOMAIN))
      .map((u) => u.id) ?? []

  if (demoIds.length === 0) {
    console.log('  (no prior demo users)')
    return
  }

  // Cascade-delete chain (matches the order we used in the manual cleanup)
  await sb.from('workshop_codes').delete().in('created_by', demoIds)
  await sb.from('workshop_reviews').delete().in('created_by', demoIds)
  await sb.from('service_records').delete().in('created_by', demoIds)
  await sb.from('service_files').delete().in('uploaded_by', demoIds)
  await sb.from('vehicle_share_tokens').delete().in('created_by', demoIds)
  await sb.from('vehicle_access').delete().in('granted_by', demoIds)
  await sb.from('family_invites').delete().in('invited_by', demoIds)
  await sb.from('fleet_invites').delete().in('invited_by', demoIds)
  await sb
    .from('fleet_orgs')
    .delete()
    .in('created_by', demoIds)

  // Workshops where ALL members are demo users (delete entire workshop record)
  const { data: demoWorkshopMembers } = await sb
    .from('workshop_members')
    .select('workshop_id')
    .in('user_id', demoIds)
  const demoWorkshopIds = [
    ...new Set((demoWorkshopMembers ?? []).map((m: any) => m.workshop_id)),
  ] as string[]
  if (demoWorkshopIds.length > 0) {
    await sb.from('workshops').delete().in('id', demoWorkshopIds)
  }

  await sb.from('audit_log').delete().in('actor_id', demoIds)

  // Delete the auth users themselves (cascades to profiles, vehicles, etc.)
  for (const id of demoIds) {
    await sb.auth.admin.deleteUser(id)
  }

  console.log(`  deleted ${demoIds.length} demo users + dependents`)
}

async function createOwners() {
  console.log('→ creating owner accounts…')
  const ids: { id: string; full_name: string }[] = []

  for (let i = 0; i < OWNERS_DATA.length; i++) {
    const o = OWNERS_DATA[i]!
    const email = `owner${i + 1}${DEMO_DOMAIN}`
    const { data, error } = await sb.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: o.full_name },
    })
    if (error || !data.user) {
      console.error('  ✗ owner', email, error)
      continue
    }
    // profile auto-created by trigger; update it
    await sb
      .from('profiles')
      .update({
        full_name: o.full_name,
        preferred_language: o.preferred_language,
      })
      .eq('id', data.user.id)
    ids.push({ id: data.user.id, full_name: o.full_name })
  }
  console.log(`  ${ids.length} owners`)
  return ids
}

async function createWorkshopOwners() {
  console.log('→ creating workshop-owner accounts…')
  const ids: { id: string; full_name: string }[] = []

  for (let i = 0; i < WORKSHOP_OWNERS_DATA.length; i++) {
    const o = WORKSHOP_OWNERS_DATA[i]!
    const email = `wo${i + 1}${DEMO_DOMAIN}`
    const { data, error } = await sb.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: o.full_name },
    })
    if (error || !data.user) {
      console.error('  ✗ workshop owner', email, error)
      continue
    }
    await sb
      .from('profiles')
      .update({ full_name: o.full_name })
      .eq('id', data.user.id)
    ids.push({ id: data.user.id, full_name: o.full_name })
  }
  console.log(`  ${ids.length} workshop owners`)
  return ids
}

async function createWorkshops(workshopOwners: { id: string; full_name: string }[]) {
  console.log('→ creating workshops…')
  const created: { id: string; name: string; slug: string; targetTier: string; emirate: string }[] = []

  for (let i = 0; i < WORKSHOPS_DATA.length; i++) {
    const w = WORKSHOPS_DATA[i]!
    const owner = workshopOwners[i]
    if (!owner) break

    // Use the claim_workshop RPC, but it requires auth.uid(). Instead, insert directly.
    const slug =
      w.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') +
      '-' +
      Math.random().toString(36).slice(2, 7)

    const trade_license_url =
      w.targetTier !== 'unverified'
        ? `https://example.com/license-${slug}.pdf`
        : null

    const { data: workshop, error } = await sb
      .from('workshops')
      .insert({
        name: w.name,
        slug,
        emirate: w.emirate,
        address: w.address,
        phone: w.phone,
        email: w.email,
        verification_tier: 'unverified', // we'll override later
        trade_license_url,
        trade_license_uploaded_at: trade_license_url ? new Date().toISOString() : null,
      })
      .select('id, name, slug')
      .single()

    if (error || !workshop) {
      console.error('  ✗ workshop', w.name, error)
      continue
    }

    await sb.from('workshop_members').insert({
      workshop_id: workshop.id,
      user_id: owner.id,
      role: 'owner',
    })

    created.push({
      id: workshop.id,
      name: workshop.name,
      slug: workshop.slug,
      targetTier: w.targetTier,
      emirate: w.emirate,
    })
  }

  console.log(`  ${created.length} workshops`)
  return created
}

async function createVehicles(owners: { id: string; full_name: string }[]) {
  console.log('→ creating vehicles…')
  const created: any[] = []

  for (let i = 0; i < VEHICLES_DATA.length; i++) {
    const v = VEHICLES_DATA[i]!
    // Distribute vehicles across owners (some have 1, some have 2-3)
    const owner = owners[i % owners.length]!
    const hero = HERO_PHOTOS[i % HERO_PHOTOS.length]!

    const { data: vehicle, error } = await sb
      .from('vehicles')
      .insert({
        owner_id: owner.id,
        make: v.make,
        model: v.model,
        year: v.year,
        color: v.color,
        plate_number: v.plate_number,
        plate_emirate: v.plate_emirate,
        nickname: v.nickname,
        current_odometer: v.current_odometer,
        current_odometer_at: new Date().toISOString(),
        hero_image_url: hero,
        allow_workshop_outreach: Math.random() > 0.6, // ~40% opt in
      })
      .select('id, make, model, current_odometer, owner_id')
      .single()

    if (error || !vehicle) {
      console.error('  ✗ vehicle', v.make, v.model, JSON.stringify(error))
      continue
    }
    created.push(vehicle)
  }

  console.log(`  ${created.length} vehicles created`)
  if (created.length === 0) {
    throw new Error('No vehicles were created — aborting before downstream chaos.')
  }
  return created
}

async function createServices(
  vehicles: any[],
  workshops: { id: string; name: string; targetTier: string }[],
  workshopOwners: { id: string }[]
) {
  console.log('→ creating service records…')
  let total = 0

  // Distribute services so Gold workshops get the most volume.
  const workshopWeights: Record<string, number> = {}
  workshops.forEach((w) => {
    workshopWeights[w.id] =
      w.targetTier === 'gold' ? 60 : w.targetTier === 'silver' ? 18 : 4
  })

  for (const v of vehicles) {
    // Each vehicle gets 4-12 services spread over 8 months
    const numServices = randInt(4, 12)
    const serviceDates: number[] = Array.from({ length: numServices }, () =>
      randInt(0, 240)
    ).sort((a, b) => b - a) // oldest first

    for (const daysBack of serviceDates) {
      const type = pick(SERVICE_TYPES)
      const [low, high] = COST_RANGES[type]!
      const cost = randInt(low, high)

      // 70% workshop-attested, 30% owner
      const isWorkshop = Math.random() < 0.7
      const workshop = isWorkshop ? pickByWeight(workshops, workshopWeights) : null
      const workshopOwnerId = workshop
        ? workshopOwners[workshops.indexOf(workshop)]?.id ?? null
        : null

      const odo = Math.max(
        500,
        v.current_odometer - Math.floor((daysBack / 240) * v.current_odometer)
      )

      await sb.from('service_records').insert({
        vehicle_id: v.id,
        service_type: type,
        service_date: isoDay(daysAgo(daysBack)),
        odometer: odo,
        cost_aed: cost,
        attestation: isWorkshop ? 'workshop' : 'owner',
        workshop_id: workshop?.id ?? null,
        workshop_name_freetext: workshop?.name ?? 'Self-logged',
        notes: pick([
          null,
          null,
          'Mobil 1 5W-30, oil filter changed too.',
          'Replaced with OEM parts.',
          'Checked alignment, all good.',
          'Customer supplied parts.',
          null,
        ]),
        created_by: isWorkshop ? workshopOwnerId : v.owner_id,
        created_at: daysAgo(daysBack).toISOString(),
      })
      total++
    }
  }

  console.log(`  ${total} service records`)
}

function pickByWeight<T extends { id: string }>(
  items: T[],
  weights: Record<string, number>
): T {
  const total = items.reduce((sum, i) => sum + (weights[i.id] ?? 1), 0)
  let r = Math.random() * total
  for (const item of items) {
    r -= weights[item.id] ?? 1
    if (r <= 0) return item
  }
  return items[items.length - 1]!
}

async function createReviews(
  vehicles: any[],
  workshops: { id: string; targetTier: string }[]
) {
  console.log('→ creating reviews…')
  let total = 0

  // Pull workshop-attested service records to attach reviews to
  const { data: workshopRecords } = await sb
    .from('service_records')
    .select('id, vehicle_id, workshop_id')
    .eq('attestation', 'workshop')
    .not('workshop_id', 'is', null)

  if (!workshopRecords) return

  // Review a random ~50% of workshop entries
  for (const rec of workshopRecords) {
    if (Math.random() > 0.5) continue

    const v = vehicles.find((x) => x.id === rec.vehicle_id)
    if (!v) continue

    const w = workshops.find((x) => x.id === rec.workshop_id)
    if (!w) continue

    // Rating biased by tier
    const baseRating =
      w.targetTier === 'gold' ? 4.5 : w.targetTier === 'silver' ? 4.1 : 3.6
    const rating = clamp(
      Math.round(baseRating + (Math.random() - 0.4) * 1.5),
      1,
      5
    )

    // Multi-axis: 60% of reviews include them
    const hasAxes = Math.random() < 0.6
    const axes = hasAxes
      ? {
          quality_rating: clamp(rating + randInt(-1, 1), 1, 5),
          value_rating: clamp(rating + randInt(-1, 1), 1, 5),
          timeliness_rating: clamp(rating + randInt(-1, 1), 1, 5),
        }
      : {}

    const { error } = await sb.from('workshop_reviews').insert({
      service_record_id: rec.id,
      workshop_id: rec.workshop_id,
      vehicle_id: rec.vehicle_id,
      rating,
      ...axes,
      comment: pick(REVIEW_COMMENTS),
      created_by: v.owner_id,
    })

    if (!error) total++
  }

  console.log(`  ${total} reviews`)
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

async function createReminders(vehicles: any[]) {
  console.log('→ creating reminders…')
  let total = 0

  for (const v of vehicles) {
    // Each vehicle gets 1-3 manually-created reminders in mixed states
    const num = randInt(1, 3)
    for (let i = 0; i < num; i++) {
      const type = pick(SERVICE_TYPES)
      const status = pick(['open', 'open', 'open', 'done'] as const) // 75% open
      const dueDate = isoDay(daysAgo(randInt(-180, 90)))
      const dueAtKm = v.current_odometer + randInt(-3000, 8000)

      await sb.from('reminders').insert({
        vehicle_id: v.id,
        reminder_type: type,
        due_date: dueDate,
        due_at_km: dueAtKm,
        status,
        notes: null,
        notified_at: status === 'open' && Math.random() < 0.3
          ? daysAgo(randInt(2, 30)).toISOString()
          : null,
      })
      total++
    }
  }

  console.log(`  ${total} reminders`)
}

async function createCodes(vehicles: any[]) {
  console.log('→ creating workshop_codes…')
  // A few used codes (matched to workshop_id of recent records) plus a couple active ones
  let total = 0
  for (const v of vehicles.slice(0, 6)) {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase()
    await sb.from('workshop_codes').insert({
      vehicle_id: v.id,
      code,
      created_by: v.owner_id,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    })
    total++
  }
  console.log(`  ${total} active codes`)
}

async function setTiers(workshops: { id: string; targetTier: string }[]) {
  console.log('→ setting workshop tiers…')
  for (const w of workshops) {
    await sb.from('workshops').update({ verification_tier: w.targetTier }).eq('id', w.id)
  }
  console.log('  tiers set')
}

// ---------------------------------------------------------------------------
// ASM Showpiece — turn ASM German Auto Garage into the demo hero workshop.
// Premium positioning: high ticket, deep history, repeat customers, glowing
// reviews with multi-axis, busy CRM (pending + upcoming).
// ---------------------------------------------------------------------------

const ASM_PREMIUM_COMMENTS = [
  "Best workshop in Dubai for German cars. Hans and the team caught a coolant leak before it became a head gasket issue. Honest pricing.",
  "Switched from the dealer two years ago — saved AED 4000 on my last major service and quality is identical. Highly recommend.",
  "They recorded the service on Vehkit which I thought was a nice touch — gives me a paper trail when I sell.",
  "Took my X5 in for brakes. Showed me the worn pads, explained the wear pattern, fitted OEM Brembo. Job done in 3 hours.",
  "Genuinely the most transparent workshop I've used in 12 years in the UAE. They invoice every line item.",
  "Quick turnaround on the AC compressor. Cool air the same day. Pricier than back-alley shops but you get what you pay for.",
  "My G-Wagen needed a 60k service. Hans called me twice during the day with photos and updates. Came in under quote.",
  "Went in for a second opinion on a brake job another shop quoted 6,500 AED. ASM did it for 3,200 with OEM parts. Lifetime customer.",
  "Took longer than estimated by a day but the work was perfect. They lent me a courtesy car which was unexpected.",
  "Polite team, clean facility, smells like a real workshop should. They actually understand BMWs.",
  null,
  "Replaced my timing chain on the 5 Series. Job was bid against three workshops. ASM won on quality not price.",
  "Smooth experience start to finish. Booked online, dropped off at 9am, picked up at 5pm. No surprises on the bill.",
  "I refer all my friends here. Even my dealer service advisor recommends them quietly.",
  null,
  "Slight delay on parts (not their fault, supplier issue) but they called me within an hour to update. Most shops just leave you wondering.",
  "Comprehensive diagnosis report — they emailed me a PDF with photos and torque specs. That's professional.",
  "Two minor issues with the alignment after — they redid it for free. Standing behind the work matters.",
  null,
  "My dad used to be a mechanic in Munich. He approves of these guys. That's the highest praise I can offer.",
]

async function boostASM(workshops: { id: string; name: string; targetTier: string }[], vehicles: any[], workshopOwners: { id: string }[]) {
  console.log('→ boosting ASM German as showpiece…')

  const asm = workshops.find((w) => w.name === 'ASM German Auto Garage')
  if (!asm) {
    console.warn('  ! ASM workshop not found, skipping boost')
    return
  }
  const asmOwnerId = workshopOwners[0]?.id // First workshop owner = Hans Müller = ASM
  if (!asmOwnerId) {
    console.warn('  ! ASM owner not found')
    return
  }

  // --- Pick the premium vehicle subset (German + premium + repeat customers) ---
  const premiumPicks = vehicles.filter((v) =>
    ['BMW', 'Mercedes-Benz', 'Audi', 'Volkswagen', 'Porsche', 'Lexus'].includes(v.make)
  )
  // Ensure we have at least 8 — pad with anything if not
  const corePool = premiumPicks.length >= 8 ? premiumPicks : vehicles.slice(0, 12)

  // 12 "regular" customers: each gets 4-7 ASM-attested services for repeat rate
  const regulars = corePool.slice(0, 12)
  // 6 occasional customers: 1-2 services each
  const occasionals = vehicles
    .filter((v) => !regulars.includes(v))
    .slice(0, 6)

  let totalServices = 0
  const PREMIUM_SERVICES: { type: string; minCost: number; maxCost: number }[] = [
    { type: 'major_service', minCost: 2400, maxCost: 4800 },
    { type: 'oil_change', minCost: 380, maxCost: 650 },
    { type: 'brake_pads', minCost: 900, maxCost: 1900 },
    { type: 'spark_plugs', minCost: 600, maxCost: 1200 },
    { type: 'coolant', minCost: 350, maxCost: 600 },
    { type: 'ac_filter', minCost: 220, maxCost: 380 },
    { type: 'wheel_alignment', minCost: 200, maxCost: 350 },
    { type: 'tyre_rotation', minCost: 150, maxCost: 280 },
    { type: 'battery', minCost: 750, maxCost: 1400 },
    { type: 'brake_fluid', minCost: 280, maxCost: 480 },
  ]

  // Regulars: spread services with growing cadence (recent = more)
  for (const v of regulars) {
    const numServices = randInt(4, 7)
    // Bias newer dates: pull from triangular distribution favoring recent
    const dates: number[] = []
    for (let i = 0; i < numServices; i++) {
      // triangular distribution: more weight to recent (smaller daysAgo)
      const u = Math.random()
      const daysBack = Math.floor(u * u * 220) + randInt(0, 7)
      dates.push(daysBack)
    }
    dates.sort((a, b) => b - a) // oldest first

    for (const daysBack of dates) {
      const svc = pick(PREMIUM_SERVICES)
      const cost = randInt(svc.minCost, svc.maxCost)
      const odo = Math.max(
        500,
        v.current_odometer - Math.floor((daysBack / 220) * v.current_odometer)
      )
      await sb.from('service_records').insert({
        vehicle_id: v.id,
        service_type: svc.type,
        service_date: isoDay(daysAgo(daysBack)),
        odometer: odo,
        cost_aed: cost,
        attestation: 'workshop',
        workshop_id: asm.id,
        workshop_name_freetext: asm.name,
        notes: pick([
          'OEM parts. Torque-spec checked. Inspection report emailed to customer.',
          'Customer requested premium synthetic oil — Liqui Moly Top Tec 4200.',
          'Brake pads and rotors inspected. Pads replaced, rotors within spec.',
          'Diagnostic showed no fault codes after service. Test driven 8km.',
          null,
          'Complimentary visual inspection — undercarriage and engine bay clean.',
          null,
          'Pre-purchase condition report attached.',
        ]),
        created_by: asmOwnerId,
        created_at: daysAgo(daysBack).toISOString(),
      })
      totalServices++
    }
  }

  // Occasionals: 1-2 services each
  for (const v of occasionals) {
    const numServices = randInt(1, 2)
    for (let i = 0; i < numServices; i++) {
      const daysBack = randInt(10, 200)
      const svc = pick(PREMIUM_SERVICES)
      const cost = randInt(svc.minCost, svc.maxCost)
      const odo = Math.max(
        500,
        v.current_odometer - Math.floor((daysBack / 220) * v.current_odometer)
      )
      await sb.from('service_records').insert({
        vehicle_id: v.id,
        service_type: svc.type,
        service_date: isoDay(daysAgo(daysBack)),
        odometer: odo,
        cost_aed: cost,
        attestation: 'workshop',
        workshop_id: asm.id,
        workshop_name_freetext: asm.name,
        notes: null,
        created_by: asmOwnerId,
        created_at: daysAgo(daysBack).toISOString(),
      })
      totalServices++
    }
  }

  // --- Pending entries (last 24h) for the dashboard's "Awaiting confirmation" ---
  for (let i = 0; i < 3; i++) {
    const v = pick(regulars)
    const svc = pick(PREMIUM_SERVICES)
    const hoursBack = randInt(2, 22) // somewhere in the 24h window
    const created = new Date(Date.now() - hoursBack * 60 * 60 * 1000)
    await sb.from('service_records').insert({
      vehicle_id: v.id,
      service_type: svc.type,
      service_date: isoDay(new Date()),
      odometer: v.current_odometer,
      cost_aed: randInt(svc.minCost, svc.maxCost),
      attestation: 'workshop',
      workshop_id: asm.id,
      workshop_name_freetext: asm.name,
      notes: 'Just completed — customer awaiting confirmation.',
      created_by: asmOwnerId,
      created_at: created.toISOString(),
    })
    totalServices++
  }

  console.log(`  ${totalServices} ASM service records added`)

  // --- Reviews: 25 with curated comments + full multi-axis, avg ~4.8 ---
  const { data: asmRecords } = await sb
    .from('service_records')
    .select('id, vehicle_id, created_at')
    .eq('workshop_id', asm.id)
    .eq('attestation', 'workshop')
    .order('created_at', { ascending: false })
    .limit(60)

  const eligible = (asmRecords ?? []).filter((r) =>
    Date.now() - new Date(r.created_at).getTime() > 24 * 60 * 60 * 1000
  )

  const reviewTargets = pickN(eligible, Math.min(25, eligible.length))
  let reviewCount = 0
  for (const rec of reviewTargets) {
    const v = vehicles.find((x) => x.id === rec.vehicle_id)
    if (!v) continue

    // Bias to 5-star with occasional 4
    const overall = Math.random() < 0.78 ? 5 : 4
    const quality = Math.random() < 0.85 ? 5 : 4
    const value = Math.random() < 0.55 ? 5 : 4 // value slightly lower (premium pricing)
    const timeliness = Math.random() < 0.7 ? 5 : 4

    const { error } = await sb.from('workshop_reviews').upsert(
      {
        service_record_id: rec.id,
        workshop_id: asm.id,
        vehicle_id: rec.vehicle_id,
        rating: overall,
        quality_rating: quality,
        value_rating: value,
        timeliness_rating: timeliness,
        comment: pick(ASM_PREMIUM_COMMENTS),
        created_by: v.owner_id,
      },
      { onConflict: 'service_record_id,created_by' }
    )
    if (!error) reviewCount++
  }
  console.log(`  ${reviewCount} ASM reviews added`)

  // --- Upcoming reminders on ASM customers — for "Upcoming · 30d" section ---
  let upcomingCount = 0
  for (const v of regulars.slice(0, 10)) {
    const inDays = randInt(2, 28)
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + inDays)
    await sb.from('reminders').insert({
      vehicle_id: v.id,
      reminder_type: pick([
        'oil_change',
        'major_service',
        'brake_pads',
        'tyre_rotation',
      ]),
      due_date: isoDay(dueDate),
      due_at_km: v.current_odometer + randInt(800, 4000),
      status: 'open',
      notes: null,
      suggested_by_workshop_id: Math.random() < 0.4 ? asm.id : null,
    })
    upcomingCount++
  }

  // A couple overdue ones to show the red bar
  for (let i = 0; i < 2; i++) {
    const v = pick(regulars)
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() - randInt(3, 18))
    await sb.from('reminders').insert({
      vehicle_id: v.id,
      reminder_type: 'oil_change',
      due_date: isoDay(dueDate),
      due_at_km: null,
      status: 'open',
      notes: null,
      suggested_by_workshop_id: asm.id,
    })
    upcomingCount++
  }
  console.log(`  ${upcomingCount} upcoming reminders for ASM customers`)

  // Make sure ASM trade license is on file (Gold prerequisite)
  await sb
    .from('workshops')
    .update({
      trade_license_url: 'https://example.com/license-asm-german.pdf',
      trade_license_uploaded_at: daysAgo(90).toISOString(),
      verification_tier: 'gold',
    })
    .eq('id', asm.id)

  console.log('  ASM showpiece complete: tier=gold, deep history, premium tickets, glowing reviews')
}

// ---------------------------------------------------------------------------
// Showcase owner attachment — makes the demo signable from a real account.
// ---------------------------------------------------------------------------

async function attachShowcaseOwnerToAsm(
  workshops: { id: string; name: string }[]
) {
  if (!SHOWCASE_EMAIL) {
    console.log('→ no SEED_SHOWCASE_EMAIL — skipping showcase owner attachment')
    return
  }
  console.log(`→ attaching ${SHOWCASE_EMAIL} as ASM owner…`)

  const asm = workshops.find((w) => w.name === 'ASM German Auto Garage')
  if (!asm) {
    console.warn('  ! ASM not found — skipping')
    return
  }

  // Find the showcase user in auth
  const { data: list } = await sb.auth.admin.listUsers({ perPage: 1000 })
  const user = list?.users?.find((u) => u.email === SHOWCASE_EMAIL)
  if (!user) {
    console.warn(`  ! ${SHOWCASE_EMAIL} not found in auth.users — sign up that account first`)
    return
  }

  // Remove this user from any OTHER workshop memberships (so /workshop lands on ASM)
  const { data: existingMemberships } = await sb
    .from('workshop_members')
    .select('workshop_id')
    .eq('user_id', user.id)

  const otherWorkshopIds =
    (existingMemberships ?? [])
      .map((m: any) => m.workshop_id as string)
      .filter((id) => id !== asm.id) ?? []

  if (otherWorkshopIds.length > 0) {
    // Drop their memberships in those orgs
    await sb
      .from('workshop_members')
      .delete()
      .eq('user_id', user.id)
      .in('workshop_id', otherWorkshopIds)

    // Delete any of those workshops that now have zero members
    for (const wid of otherWorkshopIds) {
      const { count } = await sb
        .from('workshop_members')
        .select('*', { count: 'exact', head: true })
        .eq('workshop_id', wid)
      if ((count ?? 0) === 0) {
        await sb.from('workshops').delete().eq('id', wid)
      }
    }
    console.log(`  unlinked from ${otherWorkshopIds.length} prior workshop(s)`)
  }

  // Upsert ASM membership for showcase user as owner
  await sb
    .from('workshop_members')
    .upsert(
      { workshop_id: asm.id, user_id: user.id, role: 'owner' },
      { onConflict: 'workshop_id,user_id' }
    )

  console.log(`  ✓ ${SHOWCASE_EMAIL} is now an owner of ${asm.name}`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Vehkit demo seed — UAE flavor')
  console.log('================================')
  await cleanupDemo()
  const owners = await createOwners()
  const workshopOwners = await createWorkshopOwners()
  const workshops = await createWorkshops(workshopOwners)
  const vehicles = await createVehicles(owners)
  await createServices(vehicles, workshops, workshopOwners)
  await createReviews(vehicles, workshops)
  await createReminders(vehicles)
  await createCodes(vehicles)
  await setTiers(workshops)
  await boostASM(workshops, vehicles, workshopOwners)
  await attachShowcaseOwnerToAsm(workshops)
  console.log('================================')
  console.log('✓ Demo seed complete.')
  console.log('')
  console.log('Visit:')
  console.log('  · https://vehkit.com/                  — landing with live counters')
  console.log('  · https://vehkit.com/workshops         — populated directory')
  console.log('  · https://vehkit.com/admin             — full admin dashboard')
  console.log('  · https://vehkit.com/w/asm-german-...  — sample Gold workshop profile')
  console.log('')
  console.log('To re-seed (idempotent), just re-run this script.')
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
