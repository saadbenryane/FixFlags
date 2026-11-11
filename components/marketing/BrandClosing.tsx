import Image from 'next/image'
import type { ReactNode } from 'react'
import styles from './BrandClosing.module.css'

/** Decorative brand photography stays separate from website evidence. */
export function BrandClosing({ children }: { children: ReactNode }) {
  return <div className={styles.closing}>
    <div className={styles.copy}>{children}</div>
    <div className={styles.art} aria-hidden="true">
      <Image src="/marketing/visuals/folded-f-studio-v2.webp" alt="" fill sizes="(max-width: 767px) 300px, 460px" quality={82} className={styles.light} />
      <Image src="/marketing/visuals/folded-f-studio-dark-v2.webp" alt="" fill sizes="(max-width: 767px) 300px, 460px" quality={82} className={styles.dark} />
    </div>
  </div>
}
