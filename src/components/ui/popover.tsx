'use client'

import * as PopoverPrimitive from '@radix-ui/react-popover'
import type { ComponentPropsWithoutRef, ElementRef } from 'react'
import { forwardRef } from 'react'

const Popover = PopoverPrimitive.Root
const PopoverAnchor = PopoverPrimitive.Anchor

const PopoverContent = forwardRef<
  ElementRef<typeof PopoverPrimitive.Content>,
  ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className = '', align = 'start', sideOffset = 6, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={`z-50 w-[12rem] rounded-xl border border-[color-mix(in_srgb,var(--m3-outline-variant)_50%,transparent)] bg-[color-mix(in_srgb,var(--m3-surface-container)_98%,transparent)] p-1 text-ink shadow-[0_1rem_2.5rem_color-mix(in_srgb,var(--m3-on-surface)_20%,transparent)] outline-none animate-fade-in ${className}`}
      {...props}
    />
  </PopoverPrimitive.Portal>
))
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverAnchor, PopoverContent }