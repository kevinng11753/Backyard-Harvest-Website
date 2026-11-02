import { useEffect, useState } from 'react'

// Runs an async loader and tracks { data, error, loading }.
// Re-runs whenever anything in `deps` changes.
export function useLoad(loader, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true })

  useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, loading: true }))
    loader()
      .then((data) => !cancelled && setState({ data, error: null, loading: false }))
      .catch((error) => !cancelled && setState({ data: null, error, loading: false }))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return state
}
