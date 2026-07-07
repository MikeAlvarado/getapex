import type { ReactNode } from 'react'

interface PanelProps {
  title: string
  children: ReactNode
}

export function Panel({ title, children }: PanelProps) {
  return (
    <section className="panel">
      <h2 className="panel-title">{title}</h2>
      {children}
    </section>
  )
}
