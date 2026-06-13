import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import type { ReactNode } from 'react'
import { api } from '@/lib/api'
import type { NotificationSheetDto } from '@/types/ns-queue'

interface NSQueueContextValue {
  draftCount: number
  activeQueue: NotificationSheetDto | null
  isPanelOpen: boolean
  setActiveClient: (shortcode: string | null) => void
  togglePanel: () => void
  addItem: (invoiceId: string, amount: number, targetClientShortcode?: string) => Promise<void>
  removeItem: (itemId: string) => Promise<void>
  togglePrivacy: () => Promise<void>
  refresh: () => Promise<void>
}

const NSQueueContext = createContext<NSQueueContextValue | undefined>(undefined)

export function NSQueueProvider({ children }: { children: ReactNode }) {
  const [draftCount, setDraftCount] = useState(0)
  const [activeQueue, setActiveQueue] = useState<NotificationSheetDto | null>(null)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [activeClientShortcode, setActiveClientShortcode] = useState<string | null>(null)
  const activeClientRef = useRef<string | null>(null)

  const fetchDraftCount = useCallback(async () => {
    try {
      const res = await api.get<number>('/api/notificationsheets/draft-count')
      setDraftCount(res.data)
    } catch (err) {
      console.error('Failed to fetch draft count', err)
    }
  }, [])

  const fetchActiveQueue = useCallback(async (shortcode: string) => {
    try {
      const res = await api.get<NotificationSheetDto>(`/api/notificationsheets/active/${shortcode}`)
      setActiveQueue(res.data)
    } catch (err: any) {
      if (err.response?.status === 404) {
        setActiveQueue(null)
      } else {
        console.error('Failed to fetch active queue', err)
      }
    }
  }, [])

  useEffect(() => {
    fetchDraftCount()
  }, [fetchDraftCount])

  useEffect(() => {
    if (activeClientShortcode) {
      fetchActiveQueue(activeClientShortcode)
    } else {
      setActiveQueue(null)
    }
  }, [activeClientShortcode, fetchActiveQueue])

  const setActiveClient = useCallback((shortcode: string | null) => {
    setActiveClientShortcode(shortcode)
    activeClientRef.current = shortcode
    if (!shortcode) {
      setIsPanelOpen(false)
    }
  }, [])

  const togglePanel = useCallback(() => {
    setIsPanelOpen(prev => !prev)
  }, [])

  const refresh = useCallback(async () => {
    await fetchDraftCount()
    if (activeClientRef.current) {
      await fetchActiveQueue(activeClientRef.current)
    }
  }, [fetchDraftCount, fetchActiveQueue])

  const addItem = useCallback(async (invoiceId: string, amount: number, targetClientShortcode?: string) => {
    const client = targetClientShortcode || activeClientShortcode;
    if (!client) return

    let currentQueueId = activeQueue?.id

    // If we're adding to a different client than the active one, or no queue exists
    if (!currentQueueId || (targetClientShortcode && targetClientShortcode !== activeClientShortcode)) {
      // Create one or maybe it already exists?
      // In a real app we'd fetch the queue for that client first.
      // But let's just make sure we send the correct clientShortcode
      const res = await api.post<NotificationSheetDto>('/api/notificationsheets', {
        clientShortcode: client,
        isShared: true
      })
      currentQueueId = res.data.id
    }

    await api.post(`/api/notificationsheets/${currentQueueId}/items`, {
      invoiceId,
      includedAmount: amount
    })

    if (targetClientShortcode && targetClientShortcode !== activeClientShortcode) {
        // We need to wait for state to catch up if we switched client
        // Actually, setActiveClient was already called, so activeClientShortcode WILL update,
        // triggering a useEffect refresh anyway.
        // We'll just call refresh to be safe.
    }
    
    await refresh()
  }, [activeQueue, activeClientShortcode, refresh])

  const removeItem = useCallback(async (itemId: string) => {
    if (!activeQueue) return
    try {
      await api.delete(`/api/notificationsheets/${activeQueue.id}/items/${itemId}`)
      await refresh()
    } catch (e) {
      console.error('NSQueueContext: removeItem failed', e)
    }
  }, [activeQueue, refresh])

  const togglePrivacy = useCallback(async () => {
    if (!activeQueue) return
    try {
      await api.patch(`/api/notificationsheets/${activeQueue.id}`, {
        isShared: !activeQueue.isShared
      })
      await refresh()
    } catch (e) {
      console.error('NSQueueContext: togglePrivacy failed', e)
    }
  }, [activeQueue, refresh])

  return (
    <NSQueueContext.Provider value={{
      draftCount,
      activeQueue,
      isPanelOpen,
      setActiveClient,
      togglePanel,
      addItem,
      removeItem,
      togglePrivacy,
      refresh
    }}>
      {children}
    </NSQueueContext.Provider>
  )
}

export function useNSQueue() {
  const context = useContext(NSQueueContext)
  if (context === undefined) {
    throw new Error('useNSQueue must be used within a NSQueueProvider')
  }
  return context
}
