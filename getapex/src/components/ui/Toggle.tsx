interface ToggleProps {
  label: string
  pressed: boolean
  onChange: (pressed: boolean) => void
}

export function Toggle({ label, pressed, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      className="toggle"
      aria-pressed={pressed}
      onClick={() => onChange(!pressed)}
    >
      <span className="toggle-track">
        <span className="toggle-thumb" />
      </span>
      {label}
    </button>
  )
}
