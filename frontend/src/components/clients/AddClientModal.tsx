import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"
import { Plus } from "lucide-react"
import type { Client } from "@/pages/ClientsPage"

interface AddClientModalProps {
  onClientAdded: (client: Client) => void
}

export function AddClientModal({ onClientAdded }: AddClientModalProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    shortcode: '',
    cadenceName: '',
    active: true,
    dnc: false,
    email: '',
    phone: '',
    city: '',
    province: '',
    postalCode: '',
    language: '',
    notes: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const payload = {
        ...formData,
        email: formData.email || null,
        phone: formData.phone || null,
        city: formData.city || null,
        province: formData.province || null,
        postalCode: formData.postalCode || null,
        language: formData.language || null,
        notes: formData.notes || null,
      }
      const response = await api.post<Client>('/api/clients', payload)
      onClientAdded(response.data)
      setOpen(false)
      setFormData({ shortcode: '', cadenceName: '', active: true, dnc: false, email: '', phone: '', city: '', province: '', postalCode: '', language: '', notes: '' })
    } catch (error) {
      console.error("Failed to add client:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#4648D4] hover:bg-[#3537b3] text-white">
          <Plus className="w-4 h-4 mr-2" /> Add Client
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add New Client</DialogTitle>
            <DialogDescription>
              Create a new client in the system. Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="shortcode" className="text-right">Code *</Label>
              <Input id="shortcode" required value={formData.shortcode} onChange={(e) => setFormData({ ...formData, shortcode: e.target.value.toUpperCase() })} className="col-span-3" placeholder="e.g. ACME" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="cadenceName" className="text-right">Name *</Label>
              <Input id="cadenceName" required value={formData.cadenceName} onChange={(e) => setFormData({ ...formData, cadenceName: e.target.value })} className="col-span-3" placeholder="e.g. ACME Corp" />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">Email</Label>
              <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="col-span-3" placeholder="you@example.com" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="phone" className="text-right">Phone</Label>
              <Input id="phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="col-span-3" placeholder="Enter value" />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="city" className="text-right">City</Label>
              <Input id="city" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} className="col-span-3" placeholder="City" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="province" className="text-right">Province</Label>
              <Input id="province" value={formData.province} onChange={(e) => setFormData({ ...formData, province: e.target.value })} className="col-span-3" placeholder="Province" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="postalCode" className="text-right">Postal Code</Label>
              <Input id="postalCode" value={formData.postalCode} onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })} className="col-span-3" placeholder="Postal Code" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="language" className="text-right">Language</Label>
              <Input id="language" value={formData.language} onChange={(e) => setFormData({ ...formData, language: e.target.value })} className="col-span-3" placeholder="Select language" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="notes" className="text-right">Notes</Label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="col-span-3 flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Textarea"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="active" className="text-right">Active</Label>
              <div className="col-span-3 flex items-center space-x-2">
                <input type="checkbox" id="active" checked={formData.active} onChange={(e) => setFormData({ ...formData, active: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-[#4648D4] focus:ring-[#4648D4]" />
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="dnc" className="text-right">DNC</Label>
              <div className="col-span-3 flex items-center space-x-2">
                <input type="checkbox" id="dnc" checked={formData.dnc} onChange={(e) => setFormData({ ...formData, dnc: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading} className="bg-[#4648D4] hover:bg-[#3537b3] text-white">
              {loading ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
