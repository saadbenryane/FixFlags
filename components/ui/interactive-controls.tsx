'use client'

import {
  forwardRef, useSyncExternalStore, type AriaAttributes, type ButtonHTMLAttributes,
  type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from 'react'

const subscribe = () => () => {}
const clientReady = () => true
const serverReady = () => false

/** A JavaScript control becomes available after its handlers are committed. */
export function useClientControlProps(disabled?: boolean, busy?: AriaAttributes['aria-busy']) {
  const ready = useSyncExternalStore(subscribe, clientReady, serverReady)
  return { disabled: Boolean(disabled || !ready), 'aria-busy': ready ? busy : true }
}

export const InteractiveButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ disabled, 'aria-busy': busy, ...props }, ref) => {
    const control = useClientControlProps(disabled, busy)
    return <button {...props} {...control} ref={ref} />
  },
)
InteractiveButton.displayName = 'InteractiveButton'

export const InteractiveInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ disabled, 'aria-busy': busy, ...props }, ref) => {
    const control = useClientControlProps(disabled, busy)
    return <input {...props} {...control} ref={ref} />
  },
)
InteractiveInput.displayName = 'InteractiveInput'

export const InteractiveTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ disabled, 'aria-busy': busy, ...props }, ref) => {
    const control = useClientControlProps(disabled, busy)
    return <textarea {...props} {...control} ref={ref} />
  },
)
InteractiveTextarea.displayName = 'InteractiveTextarea'

export const InteractiveSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ disabled, 'aria-busy': busy, ...props }, ref) => {
    const control = useClientControlProps(disabled, busy)
    return <select {...props} {...control} ref={ref} />
  },
)
InteractiveSelect.displayName = 'InteractiveSelect'
