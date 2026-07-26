import Image from 'next/image'
import { cn } from '@/lib/utils'

const CHECK_DIMENSIONS_CENTER = {
  src: '/marketing/visuals/check-dimensions-center.png',
  width: 790,
  height: 486,
} as const

type CheckDimensionsSceneProps = {
  className?: string
}

/** Final transparent product plate for the interactive rubric section. */
export function CheckDimensionsScene({ className }: CheckDimensionsSceneProps) {
  return (
    <div
      className={cn(
        'relative mx-auto w-full max-w-[22rem] sm:max-w-md lg:max-w-none',
        className
      )}
      aria-hidden
    >
      <Image
        src={CHECK_DIMENSIONS_CENTER.src}
        alt=""
        width={CHECK_DIMENSIONS_CENTER.width}
        height={CHECK_DIMENSIONS_CENTER.height}
        sizes="(min-width: 1024px) 380px, 90vw"
        loading="lazy"
        className="h-auto w-full select-none object-contain drop-shadow-[0_28px_48px_hsl(240_8%_5%/0.12)]"
        draggable={false}
      />
    </div>
  )
}
