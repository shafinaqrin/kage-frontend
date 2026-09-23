import type { DetailedHTMLProps, HTMLAttributes } from 'react'

type MaterialElementProps = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
  class?: string
  type?: string
  selected?: boolean
  ['aria-pressed']?: boolean
  label?: string
  placeholder?: string
  value?: string
  ['supporting-text']?: string
  onInput?: (event: React.FormEvent<HTMLElement>) => void
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'md-filled-button': MaterialElementProps
      'md-outlined-button': MaterialElementProps
      'md-divider': MaterialElementProps
      'md-filter-chip': MaterialElementProps
      'md-chip-set': MaterialElementProps
      'md-outlined-text-field': MaterialElementProps
    }
  }
}
