import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'ghost'
  active?: boolean
}

export function Button({ variant = 'default', active, className, ...rest }: ButtonProps) {
  const classes = [
    'btn',
    variant === 'primary' && 'is-primary',
    variant === 'ghost' && 'is-ghost',
    active && 'is-active',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return <button type="button" className={classes} {...rest} />
}
