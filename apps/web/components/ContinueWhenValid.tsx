'use client'

import { useEffect, useState } from 'react'

/**
 * Renders its children (typically the submit button) only when the
 * referenced form passes HTML5 validity. Listens to input + change
 * events on the form so it reacts as the user fills required fields.
 */
export function ContinueWhenValid({
  formId,
  children,
}: {
  formId: string
  children: React.ReactNode
}) {
  const [valid, setValid] = useState(false)

  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null
    if (!form) return
    const check = () => setValid(form.checkValidity())
    check()
    form.addEventListener('input', check)
    form.addEventListener('change', check)
    return () => {
      form.removeEventListener('input', check)
      form.removeEventListener('change', check)
    }
  }, [formId])

  if (!valid) return null
  return <>{children}</>
}
