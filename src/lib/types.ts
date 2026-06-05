export type SectorStatus = 'Planning' | 'In Progress' | 'Published' | 'Completed'
export type Priority = 'High' | 'Medium' | 'Low'
export type ReminderStatus = 'Open' | 'In Progress' | 'Done' | 'Overdue'
export type TipStatus = 'Not Started' | 'In Progress' | 'Created' | 'Sent'
export type DataReady = 'Yes' | 'No' | 'Partial'
export type PersonRole = 'MP' | 'BD' | 'Senior Manager' | 'Market Research' | 'Market Research Support'
// EventType is now open-ended to support the full 17-step workflow labels
export type EventType = string

export interface Sector {
  id: string
  name: string
  status: SectorStatus
  priority: Priority
  publishDate: string
  mp: string
  bd: string
  sm: string
  mr: string
  mrSupport: string
  reportLink: string
  tipLink: string
  dataLink: string
  outreachStatus: string
  notes: string
}

export interface CalendarEvent {
  id: string
  date: string
  type: EventType
  sector: string
  owner: string
  notes: string
}

export interface Reminder {
  id: string
  title: string
  sector: string
  owner: string
  roleGroup: string
  dueDate: string
  status: ReminderStatus
  priority: Priority
  action: string
  notes: string
}

export interface DataTipItem {
  sector: string
  sourceDataLocation: string
  sourceLink: string
  clayLink: string
  gsheetLink: string
  tipLink: string
  tipStatus: TipStatus
  tipCreated: string
  tipSent: string
  dataReady: DataReady
  inReport: boolean
  inTip: boolean
  notes: string
}

export interface Person {
  name: string
  role: PersonRole
  email: string
  sectors: string
  notes: string
}

export interface AppData {
  sectors: Sector[]
  calendar: CalendarEvent[]
  reminders: Reminder[]
  dataTip: DataTipItem[]
  people: Person[]
}
