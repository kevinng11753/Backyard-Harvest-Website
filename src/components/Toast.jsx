import { useEffect } from 'react'

// A short confirmation message that disappears on its own.
export default function Toast({ message, onDone }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 3200)
    return () => clearTimeout(timer)
  }, [onDone])

  return (
    <div className="toast" role="status">
      {message}
    </div>
  )
}
