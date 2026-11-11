import { Activity, Code2, FileText, Fingerprint, Gauge, MousePointer2, Search, ShieldCheck } from 'lucide-react'

/** One icon per check area, shared by the homepage cards and the coverage page. */
export const AREA_ICONS = { site: FileText, conversion: MousePointer2, security: ShieldCheck, performance: Gauge, search: Search, tracking: Code2, accessibility: Fingerprint, uptime: Activity }
