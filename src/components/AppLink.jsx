import { navigate } from '../lib/nav.js'

// A normal link that moves within the app without a full page load.
// Ctrl/Cmd-click and "open in new tab" still work. Pass newTab where leaving
// the page would lose what someone has typed (like the sign-up form).
export default function AppLink({ to, newTab = false, children }) {
  function onClick(e) {
    if (newTab || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    e.preventDefault()
    navigate(to)
  }
  return (
    <a href={to} onClick={onClick} {...(newTab ? { target: '_blank', rel: 'noopener' } : {})}>
      {children}
    </a>
  )
}
