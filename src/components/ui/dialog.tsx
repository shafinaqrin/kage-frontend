'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import type { ComponentPropsWithoutRef, ElementRef, ReactNode } from 'react'
import { forwardRef } from 'react'

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogClose = DialogPrimitive.Close

const DialogContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { narrow?: boolean }
>(({ className = '', narrow = false, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-[color-mix(in_srgb,var(--m3-scrim)_55%,transparent)] backdrop-blur-[2px]" />
    <DialogPrimitive.Content
      ref={ref}
      className={`fixed left-1/2 top-1/2 z-50 grid max-h-[calc(100dvh-2.5rem)] -translate-x-1/2 -translate-y-1/2 rounded-[1.3rem] border border-[color-mix(in_srgb,var(--m3-outline-variant)_45%,transparent)] bg-[color-mix(in_srgb,var(--m3-surface-container)_96%,transparent)] p-5 shadow-[0_1.8rem_3.5rem_color-mix(in_srgb,var(--m3-on-surface)_22%,transparent)] outline-none animate-fade-in ${narrow ? 'w-[22rem] max-w-[calc(100vw-1.5rem)]' : 'w-[30rem] max-w-[calc(100vw-1.5rem)]'} ${className}`}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 grid size-8 place-items-center rounded-full border-0 bg-transparent text-muted transition-[background,transform] duration-200 hover:bg-[color-mix(in_srgb,var(--m3-on-surface)_8%,transparent)] active:scale-90" aria-label="Close">
        ✕
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

function DialogHeader({ children }: { children: ReactNode }) {
  return <div className="mb-3 flex items-center justify-between gap-2">{children}</div>
}

function DialogTitle({ children }: { children: ReactNode }) {
  return <DialogPrimitive.Title className="m-0 text-sm font-bold tracking-[-0.01em]">{children}</DialogPrimitive.Title>
}

export { Dialog, DialogTrigger, DialogClose, DialogContent, DialogHeader, DialogTitle }