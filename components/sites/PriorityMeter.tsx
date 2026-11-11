import { SITE_DASHBOARD_COPY as C } from '@/lib/marketing/copy/site-dashboard'
import styles from './PriorityMeter.module.css'

/** Five equal bars stacked upward, filled to the Flag’s priority. Read as one image with its level named. */
export function PriorityMeter({ level, className }: { level: 1 | 2 | 3 | 4 | 5; className?: string }) {
  const label = C.priorityMeter(C.priorityLevels[level], level)
  return <span role="img" aria-label={label} title={label} className={`${styles.meter}${className ? ` ${className}` : ''}`} data-level={level}>
    {[1, 2, 3, 4, 5].map(step => <i key={step} data-on={step <= level || undefined} />)}
  </span>
}
