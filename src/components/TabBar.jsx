const TABS = [
  {
    id: 'nearby',
    label: 'Nearby',
    icon: <path d="M4 7h16M4 12h16M4 17h10" />
  },
  {
    id: 'map',
    label: 'Map',
    icon: (
      <>
        <path d="M12 21s-6-5.6-6-11a6 6 0 1 1 12 0c0 5.4-6 11-6 11z" />
        <circle cx="12" cy="10" r="2.2" />
      </>
    )
  },
  {
    id: 'post',
    label: 'Share',
    icon: <path d="M12 5v14M5 12h14" />
  },
  {
    id: 'activity',
    label: 'Activity',
    icon: (
      <>
        <path d="M5 12l4 4L19 6" />
      </>
    )
  }
]

export default function TabBar({ tab, onChange }) {
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map((t) => (
        <button
          key={t.id}
          className={`tab ${tab === t.id ? 'tab-on' : ''} ${t.id === 'post' ? 'tab-share' : ''}`}
          aria-current={tab === t.id ? 'page' : undefined}
          onClick={() => onChange(t.id)}
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {t.icon}
          </svg>
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  )
}
