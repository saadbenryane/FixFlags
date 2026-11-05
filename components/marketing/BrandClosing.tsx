import Image from 'next/image'
import type { ReactNode } from 'react'
import styles from './BrandClosing.module.css'

/** Decorative brand photography stays separate from website evidence. */
export function BrandClosing({ children }: { children: ReactNode }) {
  return <div className={styles.closing}>
    <div className={styles.copy}>{children}</div>
    <div className={styles.art} aria-hidden="true">
      <Image src="/marketing/visuals/folded-f-studio-v1.webp" alt="" fill sizes="(max-width: 639px) 300px, 460px" className={styles.light} />
      <Image src="/marketing/visuals/folded-f-studio-dark-v1.webp" alt="" fill sizes="(max-width: 639px) 300px, 460px" className={styles.dark} />
    </div>
  </div>
}
