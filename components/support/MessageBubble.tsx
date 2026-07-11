import { cn } from '@/lib/utils'

interface MessageBubbleProps {
  variant: 'agent' | 'visitor'
  children: React.ReactNode
}

export function MessageBubble({ variant, children }: MessageBubbleProps) {
  return (
    <div className={cn('flex', variant === 'visitor' ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed',
          variant === 'visitor'
            ? 'bg-brand text-brand-foreground rounded-br-md'
            : 'bg-muted text-foreground rounded-bl-md'
        )}
      >
        {children}
      </div>
    </div>
  )
}
