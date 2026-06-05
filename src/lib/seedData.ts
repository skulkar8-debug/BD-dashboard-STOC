import type { AppData, Sector, CalendarEvent, Reminder, DataTipItem, Person, SectorStatus, Priority } from './types'
import { WORKFLOW_EVENTS, type OwnerRole } from './workflowEvents'

// ─── helpers ─────────────────────────────────────────────────────────────────
function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().split('T')[0]
}

// ─── raw sector table ─────────────────────────────────────────────────────────
// [id, name, status, priority, publishDate, mp, bd, sm, outreachStatus, notes]
type Raw = [string, string, SectorStatus, Priority, string, string, string, string, string, string]

const RAW_SECTORS: Raw[] = [
  ['S001','MedSpa',              'Completed','High',  '2026-04-21','Mike', 'Lucius', 'Anne', 'Completed', 'Provider/aesthetician capacity, service breadth, memberships, digital maturity.'],
  ['S002','Veterinary',          'Completed','High',  '2026-05-26','Drew', 'Peyton','Sean', 'Completed', 'DVM count, staff count, service breadth, facility capacity, local consolidation.'],
  ['S003','Commercial Landscaping','In Progress','High','2026-06-11','Mike', 'Peyton','Anne', 'In Progress','Recurring commercial maintenance, route density, crew capacity, snow/ice diversification.'],
  ['S004','Pest Control',        'Planning', 'High',  '2026-06-30','Drew', 'Peyton','Sean', 'Not Started','Recurring route revenue, technician density, termite/wildlife specialization.'],
  ['S005','Funeral Homes',       'Planning', 'High',  '',          'Mike', 'Lucius','Sam',  'Not Started','Cremation capability, pre-need revenue, family-owned fragmentation.'],
  ['S006','Youth Sports',        'Planning', 'High',  '',          'Drew', 'Peyton','Matt', 'Not Started','Facility utilization, recurring registrations, tournaments, club networks.'],
  ['S007','Tire & Auto Repair',  'Planning', 'High',  '',          'Mike', 'Lucius','Anne', 'Not Started','Bay count, technician count, tire sales mix, fleet/commercial accounts.'],
  ['S008','Collision Repair',    'Planning', 'High',  '',          'Drew', 'Peyton','Sean', 'Not Started','Insurance relationships, OEM certifications, paint booth capacity.'],
  ['S009','Managed Service Provider (MSP)','Planning','High','',   'Mike', 'Lucius','Sam',  'Not Started','Recurring managed services, cybersecurity depth, technical headcount.'],
  ['S010','Security Services',   'Planning', 'High',  '',          'Drew', 'Peyton','Matt', 'Not Started','Guard force scale, recurring contracts, patrol/monitoring mix.'],
  ['S011','Garage Door Repair',  'Planning', 'High',  '',          'Mike', 'Lucius','Anne', 'Not Started','Technician density, emergency service, installation/repair mix.'],
  ['S012','Behavioral Health',   'Planning', 'High',  '',          'Drew', 'Peyton','Sean', 'Not Started','Clinician capacity, payer mix, specialty depth, telehealth.'],
  ['S013','Orthodontics',        'Planning', 'High',  '',          'Mike', 'Lucius','Sam',  'Not Started','Provider count, clear aligner adoption, financing, location density.'],
  ['S014','Digital Marketing Agencies','Planning','Medium','',     'Drew', 'Peyton','Matt', 'Not Started','Recurring retainer revenue, vertical specialization, technical service breadth.'],
  ['S015','Pain Management',     'Planning', 'High',  '',          'Mike', 'Lucius','Anne', 'Not Started','Physician capacity, procedure breadth, referral streams, payer access.'],
  ['S016','Physical Therapy',    'Planning', 'High',  '',          'Drew', 'Peyton','Sean', 'Not Started','Clinician count, referral relationships, specialty programs, clinic density.'],
  ['S017','Commercial Painting', 'Planning', 'Medium','',          'Mike', 'Lucius','Sam',  'Not Started','Commercial project mix, crew capacity, safety credentials, regional coverage.'],
  ['S018','Industrial Coating',  'Planning', 'Medium','',          'Drew', 'Peyton','Matt', 'Not Started','Certification depth, industrial client base, equipment intensity.'],
  ['S019','Industrial Safety Consulting','Planning','Medium','',   'Mike', 'Lucius','Anne', 'Not Started','Trainer count, recurring compliance audits, course catalog breadth.'],
  ['S020','Dermatology',         'Planning', 'High',  '',          'Drew', 'Peyton','Sean', 'Not Started','Provider count, medical/cosmetic mix, Mohs capability, high-margin services.'],
  ['S021','Psychiatric Clinics', 'Planning', 'High',  '',          'Mike', 'Lucius','Sam',  'Not Started','Provider count, medication management, telehealth, advanced therapies.'],
  ['S022','Home Health',         'Planning', 'High',  '',          'Drew', 'Peyton','Matt', 'Not Started','Caregiver supply, payer mix, referral sources, census capacity.'],
  ['S023','Hospice',             'Planning', 'High',  '',          'Mike', 'Lucius','Anne', 'Not Started','Clinical staffing, census capacity, referral density, facility partnerships.'],
  ['S024','Fire & Life Safety',  'Planning', 'High',  '',          'Drew', 'Peyton','Sean', 'Not Started','Inspection recurring revenue, technician capacity, code-driven demand.'],
  ['S025','HVAC Services',       'Planning', 'High',  '',          'Mike', 'Lucius','Sam',  'Not Started','Maintenance contracts, technician count, residential/commercial mix.'],
  ['S026','Plumbing Services',   'Planning', 'High',  '',          'Drew', 'Peyton','Matt', 'Not Started','Emergency demand, technician density, recurring/commercial accounts.'],
  ['S027','Electrical Services', 'Planning', 'High',  '',          'Mike', 'Lucius','Anne', 'Not Started','Licensed technician count, commercial exposure, generator/EV adjacency.'],
  ['S028','Restoration Services','Planning', 'High',  '',          'Drew', 'Peyton','Sean', 'Not Started','Emergency response, insurance relationships, equipment intensity.'],
  ['S029','Roofing Services',    'Planning', 'High',  '',          'Mike', 'Lucius','Sam',  'Not Started','Crew capacity, replacement demand, insurance work, commercial/residential mix.'],
  ['S030','Waste & Recycling',   'Planning', 'High',  '',          'Drew', 'Peyton','Matt', 'Not Started','Route density, recurring hauling contracts, facility permits.'],
  ['S031','Pool Services',       'Planning', 'Medium','',          'Mike', 'Lucius','Anne', 'Not Started','Recurring cleaning/maintenance, route density, repair/install cross-sell.'],
  ['S032','Property Management / HOA Services','Planning','Medium','','Drew','Peyton','Sean','Not Started','Unit count, HOA contracts, recurring management fees.'],
  ['S033','Tutoring & Test Prep','Planning', 'Medium','',          'Mike', 'Lucius','Sam',  'Not Started','Instructor capacity, recurring enrollments, test prep specialization.'],
  ['S034','Sports Tech / League Management','Planning','Low','',   'Drew', 'Peyton','Matt', 'Not Started','Recurring SaaS/services, club/league customer base.'],
  ['S035','Dental Practices',    'Planning', 'High',  '',          'Mike', 'Lucius','Anne', 'Not Started','Dentist count, hygiene capacity, specialty mix, membership plans.'],
  ['S036','Oral Surgery',        'Planning', 'Medium','',          'Drew', 'Peyton','Sean', 'Not Started','Provider count, referral base, anesthesia/surgical capability.'],
  ['S037','Endodontics',         'Planning', 'Medium','',          'Mike', 'Lucius','Sam',  'Not Started','Specialist density, referral network, procedure volume proxies.'],
  ['S038','Periodontics',        'Planning', 'Medium','',          'Drew', 'Peyton','Matt', 'Not Started','Specialist count, implant/gum surgery mix, referral dependency.'],
  ['S039','Ophthalmology',       'Planning', 'Medium','',          'Mike', 'Lucius','Anne', 'Not Started','MD count, surgical service mix, optical/ASC adjacency.'],
  ['S040','ENT Practices',       'Planning', 'Medium','',          'Drew', 'Peyton','Sean', 'Not Started','Provider count, procedure breadth, audiology adjacency.'],
  ['S041','Allergy & Asthma Clinics','Planning','Medium','',       'Mike', 'Lucius','Sam',  'Not Started','Provider count, recurring immunotherapy, payer access.'],
  ['S042','Gastroenterology',    'Planning', 'Medium','',          'Drew', 'Peyton','Matt', 'Not Started','Provider count, ASC/endoscopy center adjacency.'],
  ['S043','Urology',             'Planning', 'Medium','',          'Mike', 'Lucius','Anne', 'Not Started','Provider count, procedure breadth, imaging/lab adjacency.'],
  ['S044','Women\'s Health / OB-GYN','Planning','Medium','',       'Drew', 'Peyton','Sean', 'Not Started','Provider count, service breadth, payer mix, ancillary services.'],
  ['S045','Fertility Clinics',   'Planning', 'Medium','',          'Mike', 'Lucius','Sam',  'Not Started','Physician/embryologist capacity, IVF lab, cycle volume proxies.'],
  ['S046','Ambulatory Surgery Centers','Planning','Medium','',     'Drew', 'Peyton','Matt', 'Not Started','OR/procedure room capacity, specialty mix, physician ownership.'],
  ['S047','Imaging Centers',     'Planning', 'Medium','',          'Mike', 'Lucius','Anne', 'Not Started','Modality breadth, referral base, equipment intensity, payer access.'],
  ['S048','Urgent Care',         'Planning', 'Medium','',          'Drew', 'Peyton','Sean', 'Not Started','Visit volume proxy, provider staffing, hours, payer access.'],
  ['S049','Occupational Medicine','Planning','Medium','',          'Mike', 'Lucius','Sam',  'Not Started','Employer contracts, service breadth, recurring screening/testing.'],
  ['S050','ABA Therapy',         'Planning', 'High',  '',          'Drew', 'Peyton','Matt', 'Not Started','Clinician/BCBA capacity, center-based model, payer access.'],
  ['S051','Addiction Treatment', 'Planning', 'Medium','',          'Mike', 'Lucius','Anne', 'Not Started','Beds/census capacity, levels of care, payer mix, clinical staffing.'],
  ['S052','Senior Living',       'Planning', 'Medium','',          'Drew', 'Peyton','Sean', 'Not Started','Unit count, occupancy proxy, care levels, regional portfolio.'],
  ['S053','Memory Care',         'Planning', 'Medium','',          'Mike', 'Lucius','Sam',  'Not Started','Specialized bed/unit capacity, staff ratio proxy, programming.'],
  ['S054','RCM / Medical Billing','Planning','Medium','',          'Drew', 'Peyton','Matt', 'Not Started','Recurring revenue, specialty focus, client count, offshore delivery.'],
  ['S055','Accounting & Bookkeeping Outsourcing','Planning','Medium','','Mike','Lucius','Anne','Not Started','Recurring client base, vertical focus, staff leverage, tech-enabled.'],
  ['S056','Payroll / HCM Services','Planning','Medium','',         'Drew', 'Peyton','Sean', 'Not Started','Recurring payroll revenue, client count, HR add-ons, compliance.'],
  ['S057','Insurance TPA / Claims Services','Planning','Medium','','Mike','Lucius','Sam',   'Not Started','Claims volume, carrier relationships, specialty lines.'],
  ['S058','Legal Process Outsourcing / IP Services','Planning','Medium','','Drew','Peyton','Matt','Not Started','Services-led delivery, specialist staff, law firm client base.'],
  ['S059','Environmental Consulting','Planning','Medium','',       'Mike', 'Lucius','Anne', 'Not Started','Recurring compliance work, professional headcount, permitting.'],
  ['S060','Engineering Services','Planning', 'Medium','',          'Drew', 'Peyton','Sean', 'Not Started','Professional headcount, discipline mix, public/private client base.'],
  ['S061','Architecture & Design','Planning','Low',   '',          'Mike', 'Lucius','Sam',  'Not Started','Professional headcount, vertical specialization, repeat clients.'],
  ['S062','Testing / Inspection / Certification','Planning','Medium','','Drew','Peyton','Matt','Not Started','Recurring compliance testing, technician/lab capacity.'],
  ['S063','Lab Testing Services','Planning', 'Medium','',          'Mike', 'Lucius','Anne', 'Not Started','Sample volume proxy, accreditation, specialty testing breadth.'],
  ['S064','Industrial Automation Integrators','Planning','Low','', 'Drew', 'Peyton','Sean', 'Not Started','Engineering headcount, vendor partnerships, project backlog.'],
  ['S065','Facilities Maintenance','Planning','Medium','',         'Mike', 'Lucius','Sam',  'Not Started','Recurring contracts, technician network, trade breadth.'],
  ['S066','Commercial Cleaning / Janitorial','Planning','Medium','','Drew','Peyton','Matt', 'Not Started','Recurring contracts, labor scale, route density.'],
  ['S067','Residential Cleaning','Planning', 'Low',   '',          'Mike', 'Lucius','Anne', 'Not Started','Recurring home cleanings, route density, technician labor.'],
  ['S068','Tree Care',           'Planning', 'Medium','',          'Drew', 'Peyton','Sean', 'Not Started','Crew/equipment capacity, recurring municipal/commercial accounts.'],
  ['S069','Irrigation Services', 'Planning', 'Low',   '',          'Mike', 'Lucius','Sam',  'Not Started','Recurring maintenance, install/repair mix, commercial landscape.'],
  ['S070','Snow & Ice Management','Planning','Low',   '',          'Drew', 'Peyton','Matt', 'Not Started','Seasonal recurring contracts, fleet capacity, commercial density.'],
  ['S071','Kitchen & Bath Remodeling','Planning','Low','',         'Mike', 'Lucius','Anne', 'Not Started','Project backlog, design-build capability, showroom presence.'],
  ['S072','Basement Waterproofing','Planning','Low',  '',          'Drew', 'Peyton','Sean', 'Not Started','Recurring demand from housing stock, crew capacity, financing.'],
  ['S073','Foundation Repair',   'Planning', 'Low',   '',          'Mike', 'Lucius','Sam',  'Not Started','Specialized equipment/crew capability, high-ticket projects.'],
  ['S074','Gutter Services',     'Planning', 'Low',   '',          'Drew', 'Peyton','Matt', 'Not Started','Install/maintenance mix, route density, exterior services cross-sell.'],
  ['S075','Window & Door Installers','Planning','Low','',          'Mike', 'Lucius','Anne', 'Not Started','Replacement demand, dealer/manufacturer relationships.'],
  ['S076','Solar Installation',  'Planning', 'Low',   '',          'Drew', 'Peyton','Sean', 'Not Started','Installer capacity, financing model, battery/EV add-ons.'],
  ['S077','Insulation Contractors','Planning','Low',  '',          'Mike', 'Lucius','Sam',  'Not Started','Energy-efficiency demand, crew capacity, builder relationships.'],
  ['S078','Septic Services',     'Planning', 'Low',   '',          'Drew', 'Peyton','Matt', 'Not Started','Recurring pumping, emergency repair, route density.'],
  ['S079','Water Treatment Services','Planning','Low','',          'Mike', 'Lucius','Anne', 'Not Started','Recurring filter/service revenue, install base, equipment partnerships.'],
]

export const SECTORS: Sector[] = RAW_SECTORS.map(
  ([id, name, status, priority, publishDate, mp, bd, sm, outreachStatus, notes]) => ({
    id, name, status, priority, publishDate,
    mp, bd, sm, mr: 'Srushti', mrSupport: 'Sharvan',
    reportLink: '', tipLink: '', dataLink: '',
    outreachStatus, notes,
  })
)

// ─── derive calendar events from sector dates (full 17-step workflow) ────────
function sectorToCalendarEvents(s: Sector): CalendarEvent[] {
  if (!s.publishDate) return []
  const p = s.publishDate
  const ownerMap: Record<OwnerRole, string> = {
    mr: s.mr, mrsupport: s.mrSupport, bd: s.bd, sm: s.sm, mp: s.mp,
  }
  return WORKFLOW_EVENTS.map(ev => {
    const primaryOwner = ownerMap[ev.owners[0]] ?? ''
    return {
      id:     `EVT-${s.id}-${ev.key.toUpperCase()}`,
      date:   addDays(p, ev.sOff),       // use start date for calendar placement
      type:   ev.label,                  // clean label — no WF prefix
      sector: s.name,
      owner:  primaryOwner,
      notes:  `${ev.label} · ${ev.wfSteps} · ${ev.phase}`,
    }
  })
}

// ─── derive reminders from sector dates ───────────────────────────────────────
function sectorToReminders(s: Sector): Reminder[] {
  if (!s.publishDate) return []
  const p = s.publishDate
  const done = s.status === 'Completed'
  const st = (d: string) => done ? 'Done' as const : (new Date(d) < new Date('2026-06-05') ? 'Overdue' as const : 'Open' as const)
  return [
    { id: `REM-${s.id}-R14-BD`,  title: `14d outreach — ${s.name}`,        sector: s.name, owner: s.bd, roleGroup: 'BD',                       dueDate: addDays(p,-14), status: st(addDays(p,-14)), priority: 'High',   action: 'Start LinkedIn outreach — PE contacts, VPs/Principals, industry groups.',     notes: '' },
    { id: `REM-${s.id}-R14-SM`,  title: `14d connections — ${s.name}`,     sector: s.name, owner: s.sm, roleGroup: 'Senior Manager',            dueDate: addDays(p,-14), status: st(addDays(p,-14)), priority: 'Medium', action: 'Connect with LinkedIn industry groups / relationship contacts. Reminder only.', notes: '' },
    { id: `REM-${s.id}-R7-BD`,   title: `7d confirm outreach — ${s.name}`, sector: s.name, owner: s.bd, roleGroup: 'BD',                       dueDate: addDays(p,-7),  status: st(addDays(p,-7)),  priority: 'High',   action: 'Confirm LinkedIn connections are in motion and report send list is ready.',    notes: '' },
    { id: `REM-${s.id}-PUB-MR`,  title: `Publish report — ${s.name}`,      sector: s.name, owner: s.mr, roleGroup: 'Market Research',           dueDate: p,              status: st(p),              priority: 'High',   action: 'Coordinate report publication and confirm related links are added.',           notes: '' },
    { id: `REM-${s.id}-TIP-SM`,  title: `TIP coordination — ${s.name}`,    sector: s.name, owner: s.sm, roleGroup: 'Senior Manager',            dueDate: addDays(p, 1),  status: st(addDays(p,1)),   priority: 'Medium', action: 'Coordinate/remind on TIP creation and send timing. Reminder only.',           notes: '' },
    { id: `REM-${s.id}-POST-BD`, title: `Post-publish follow-up — ${s.name}`, sector: s.name, owner: s.bd, roleGroup: 'BD',                    dueDate: addDays(p, 7),  status: st(addDays(p,7)),   priority: 'Medium', action: 'Follow up, schedule calls, and capture intel.',                              notes: '' },
  ]
}

// ─── people ───────────────────────────────────────────────────────────────────
export const PEOPLE: Person[] = [
  { name: 'Mike',    role: 'MP',                       email: 'mike@stocadvisory.com',    sectors: 'MedSpa, Commercial Landscaping, Funeral Homes, Tire & Auto, MSP, Garage Door, Orthodontics, Pain Mgmt, Commercial Painting, Industrial Safety, Psychiatric, Hospice, HVAC, Electrical, Roofing, Pool, Tutoring, Dental, Endodontics, Ophthalmology, Allergy, Urology, Fertility, Imaging, Occupational Med, Memory Care, Accounting, Insurance TPA, Environmental, Architecture, Lab Testing, Facilities, Residential Clean, Irrigation, Kitchen & Bath, Foundation, Window & Door, Insulation, Water Treatment', notes: 'Strategic / follow-on only. No daily task ownership unless explicitly assigned.' },
  { name: 'Drew',    role: 'MP',                       email: 'drew@stocadvisory.com',    sectors: 'Veterinary, Pest Control, Youth Sports, Collision Repair, Security Services, Behavioral Health, Digital Marketing, Physical Therapy, Industrial Coating, Dermatology, Home Health, Fire & Life Safety, Plumbing, Restoration, Waste & Recycling, Property Mgmt, Sports Tech, Oral Surgery, Periodontics, ENT, Gastroenterology, Women\'s Health, ASC, Urgent Care, ABA Therapy, Senior Living, RCM, Payroll, Legal Process, Engineering, Testing/Inspection, Industrial Auto, Commercial Cleaning, Tree Care, Snow & Ice, Basement Water, Gutter, Solar, Septic', notes: 'Strategic / follow-on only. No daily task ownership unless explicitly assigned.' },
  { name: 'Anne',    role: 'Senior Manager',           email: 'anne@stocadvisory.com',    sectors: 'Commercial Landscaping, Tire & Auto, Garage Door, Pain Mgmt, Commercial Painting, Hospice, Electrical, Roofing, Tutoring, Ophthalmology, Urology, Imaging, Memory Care, Environmental, Architecture, Lab Testing, Irrigation, Kitchen & Bath, Window & Door, Water Treatment', notes: 'Reminder-only for connection/outreach support. Not a workstream owner.' },
  { name: 'Sean',    role: 'Senior Manager',           email: 'sean@stocadvisory.com',    sectors: 'Pest Control, Collision Repair, Behavioral Health, Physical Therapy, Dermatology, Fire & Life Safety, Restoration, Property Mgmt, Oral Surgery, ENT, Women\'s Health, Urgent Care, Senior Living, Payroll, Engineering, Industrial Auto, Tree Care, Basement Water, Solar, Septic', notes: 'Reminder-only for connection/outreach support. Not a workstream owner.' },
  { name: 'Sam',     role: 'Senior Manager',           email: 'sam@stocadvisory.com',     sectors: 'Funeral Homes, MSP, Orthodontics, HVAC, Pool, Endodontics, Allergy, Fertility, Occupational Med, Accounting, Insurance TPA, Facilities, Foundation, Insulation', notes: 'Reminder-only for connection/outreach support. Not a workstream owner.' },
  { name: 'Matt',    role: 'Senior Manager',           email: 'matt@stocadvisory.com',    sectors: 'Youth Sports, Security Services, Digital Marketing, Industrial Coating, Home Health, Plumbing, Waste & Recycling, Sports Tech, Periodontics, Gastroenterology, ASC, ABA Therapy, RCM, Legal Process, Testing/Inspection, Commercial Cleaning, Snow & Ice, Gutter, Septic', notes: 'Reminder-only for connection/outreach support. Not a workstream owner.' },
  { name: 'Lucius',  role: 'BD',                       email: 'lucius@stocadvisory.com',  sectors: 'MedSpa, Funeral Homes, Tire & Auto, MSP, Garage Door, Orthodontics, Pain Mgmt, Commercial Painting, Industrial Safety, Psychiatric, Hospice, HVAC, Electrical, Roofing, Pool, Tutoring, Dental, Endodontics, Ophthalmology, Allergy, Urology, Fertility, Imaging, Occupational Med, Memory Care, Accounting, Insurance TPA, Environmental, Architecture, Lab Testing, Facilities, Residential Clean, Irrigation, Kitchen & Bath, Foundation, Window & Door, Insulation, Water Treatment', notes: 'LinkedIn outreach, report send, follow-up, intel capture.' },
  { name: 'Peyton',  role: 'BD',                       email: 'peyton@stocadvisory.com',  sectors: 'Veterinary, Commercial Landscaping, Pest Control, Youth Sports, Collision Repair, Security Services, Behavioral Health, Digital Marketing, Physical Therapy, Industrial Coating, Dermatology, Home Health, Fire & Life Safety, Plumbing, Restoration, Waste & Recycling, Property Mgmt, Sports Tech, Oral Surgery, Periodontics, ENT, Gastroenterology, Women\'s Health, ASC, ABA Therapy, Senior Living, RCM, Payroll, Legal Process, Engineering, Testing/Inspection, Industrial Auto, Commercial Cleaning, Tree Care, Snow & Ice, Basement Water, Gutter, Solar, Septic', notes: 'LinkedIn outreach, report send, follow-up, intel capture.' },
  { name: 'Srushti', role: 'Market Research',          email: 'srushti@stocadvisory.com', sectors: 'All sectors', notes: 'Report production, data tracking, publishing coordination, Data + TIP Sync.' },
  { name: 'Sharvan', role: 'Market Research Support',  email: 'sharvan@stocadvisory.com', sectors: 'All sectors (support)', notes: 'Supports Srushti on data sourcing and enrichment.' },
]

// ─── assemble ─────────────────────────────────────────────────────────────────
export const SEED_DATA: AppData = {
  sectors:   SECTORS,
  calendar:  SECTORS.flatMap(sectorToCalendarEvents),
  reminders: SECTORS.flatMap(sectorToReminders),
  dataTip:   SECTORS.map(s => ({
    sector:              s.name,
    sourceDataLocation:  '',
    sourceLink:          '',
    clayLink:            '',
    gsheetLink:          '',
    tipLink:             s.tipLink,
    tipStatus:           'Not Started',
    tipCreated:          '',
    tipSent:             '',
    dataReady:           'No',
    inReport:            false,
    inTip:               false,
    notes:               '',
  })),
  people: PEOPLE,
}
