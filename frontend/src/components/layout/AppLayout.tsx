import React from 'react'
import { TopNav } from './TopNav'
import { NSQueueProvider, useNSQueue } from '@/context/NSQueueContext'
import { NSQueuePanel } from '@/components/ns-queue/NSQueuePanel'
import { cn } from '@/lib/utils'

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const { isPanelOpen } = useNSQueue()

  return (
    <div className="relative flex min-h-screen flex-col">
      <TopNav />
      <NSQueuePanel />
      <main className={cn(
        "flex-1 flex flex-col w-full transition-all duration-300 ease-in-out",
        isPanelOpen ? "ml-80 w-[calc(100%-20rem)]" : "ml-0"
      )}>
        {children}
      </main>
    </div>
  )
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <NSQueueProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
    </NSQueueProvider>
  )
}
