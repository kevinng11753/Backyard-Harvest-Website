// The app has no router, and only a couple of pages with their own address
// (/terms and /privacy). This moves to one of them without reloading the
// page, and tells App that the address changed.
export const NAV_EVENT = 'app:navigate'

export function navigate(to) {
  window.history.pushState(null, '', to)
  window.dispatchEvent(new Event(NAV_EVENT))
  window.scrollTo({ top: 0 })
}
