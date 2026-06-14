import { useEffect } from 'react'
import { DEMO } from '../config/demo-config'

const SUFFIX = `· ${DEMO.appName}`

export function useDocumentTitle(title: string) {
  useEffect(() => {
    const prev = document.title
    document.title = title ? `${title} ${SUFFIX}` : DEMO.appName
    return () => { document.title = prev }
  }, [title])
}
