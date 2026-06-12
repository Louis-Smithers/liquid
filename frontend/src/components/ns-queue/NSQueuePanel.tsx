import { Link } from 'react-router-dom'
import { Lock, Unlock, X, Trash2 } from 'lucide-react'
import { useNSQueue } from '@/context/NSQueueContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export function NSQueuePanel() {
  const { activeQueue, isPanelOpen, togglePanel, removeItem, togglePrivacy } = useNSQueue()

  return (
    <aside 
      className={cn(
        "fixed left-0 top-14 h-[calc(100vh-3.5rem)] w-80 bg-background border-r shadow-lg transition-transform duration-300 ease-in-out z-40 flex flex-col",
        isPanelOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="font-semibold">NS Queue</h3>
            {activeQueue && (
              <Badge variant="secondary">{activeQueue.clientShortcode}</Badge>
            )}
          </div>
          {activeQueue && (
            <div className="text-xs text-muted-foreground mt-1 truncate" title={activeQueue.displayName}>
              {activeQueue.displayName}
            </div>
          )}
        </div>
        <div className="flex items-center space-x-1">
          {activeQueue && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={togglePrivacy} title={activeQueue.isShared ? "Make Private" : "Make Shared"}>
              {activeQueue.isShared ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={togglePanel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {!activeQueue || activeQueue.items.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground mt-10">
            No items in queue.
          </div>
        ) : (
          activeQueue.items.map(item => (
            <div key={item.id} className="group flex items-start justify-between bg-muted/50 p-3 rounded-md border text-sm">
              <div className="flex-1 pr-2">
                <div className="font-medium">{item.invoiceNumber}</div>
                <div className="text-muted-foreground truncate" title={item.debtorName}>{item.debtorName}</div>
                <div className="font-semibold mt-1">
                  ${item.includedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                title="Remove Item"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                onClick={() => removeItem(item.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>

      <div className="p-4 border-t bg-muted/20">
        <Button asChild className="w-full">
          <Link to="/ns-queue">
            Open NS Queue &rarr;
          </Link>
        </Button>
      </div>
    </aside>
  )
}
