import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Omnibar } from './Omnibar'
import { useNSQueue } from '@/context/NSQueueContext'
import { Badge } from '@/components/ui/badge'

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'

export function TopNav() {
  const location = useLocation()
  const { draftCount } = useNSQueue()
  const { user, role, signOut } = useAuth()
  
  const navItems = [
    { name: 'Clients', path: '/clients' },
    { name: 'Debtors', path: '/debtors' },
    { name: 'Scan Invoice', path: '/scan' },
    { name: 'Import Queue', path: '/queue' },
    { name: 'Aging Report', path: '/aging' },
  ]

  if (role === 'admin') {
    navItems.push({ name: 'Admin', path: '/admin' })
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="w-full flex h-14 items-center px-8">
        <div className="mr-4 flex">
          <Link to="/" className="mr-6 flex items-center space-x-2">
            <span className="hidden font-bold sm:inline-block tracking-tight text-lg">
              Smithers
            </span>
          </Link>
          <nav className="flex items-center space-x-6 text-sm font-medium">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "transition-colors hover:text-foreground/80",
                  location.pathname === item.path ? "text-foreground" : "text-foreground/60"
                )}
              >
                {item.name}
              </Link>
            ))}
            <Link
              to="/ns-queue"
              className={cn(
                "transition-colors hover:text-foreground/80 flex items-center",
                location.pathname === '/ns-queue' ? "text-foreground" : "text-foreground/60"
              )}
            >
              NS Queue
              {draftCount > 0 && (
                <Badge variant="default" className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                  {draftCount}
                </Badge>
              )}
            </Link>
          </nav>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-4">
          <Omnibar />
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full border bg-muted">
                  <span className="text-xs">{user.email?.charAt(0).toUpperCase()}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    {user.user_metadata?.first_name && <p className="font-medium">{user.user_metadata.first_name} {user.user_metadata.last_name}</p>}
                    <p className="w-[200px] truncate text-sm text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <DropdownMenuItem onClick={signOut} className="cursor-pointer">
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  )
}
