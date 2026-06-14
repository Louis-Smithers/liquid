import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface Debtor {
  id: string
  name: string
  cadenceName: string | null
  contact: string | null
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  province: string | null
  active: boolean
}

export function ClientPortalDebtorsPage() {
  const { session, clientShortcode } = useAuth()
  const [debtors, setDebtors] = useState<Debtor[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clientShortcode) return
    fetch(`/api/debtors/by-client/${clientShortcode}`, {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
      .then(r => r.ok ? r.json() : [])
      .then(setDebtors)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [clientShortcode, session])

  return (
    <div className="flex flex-col gap-6 w-full h-full min-h-[960px] bg-[#F7F9FB] p-8 pt-0">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Debtors</h1>
        <p className="text-muted-foreground text-sm mt-1">{debtors.length} debtor{debtors.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="rounded-md border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Province</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : debtors.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">No debtors found.</TableCell></TableRow>
            ) : debtors.map(d => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.name}</TableCell>
                <TableCell>{d.contact ?? '—'}</TableCell>
                <TableCell>{d.email ?? '—'}</TableCell>
                <TableCell>{d.phone ?? '—'}</TableCell>
                <TableCell>{d.city ?? '—'}</TableCell>
                <TableCell>{d.province ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
