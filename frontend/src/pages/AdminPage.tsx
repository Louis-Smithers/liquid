import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

interface AccessRequest {
  id: string;
  email: string;
  usernameWanted: string;
  firstName: string;
  lastName: string;
  status: string;
  createdAt: string;
}

interface ClientOption {
  shortcode: string;
  cadenceName: string;
}

export function AdminPage() {
  const { session, role } = useAuth();
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<ClientOption[]>([]);

  const [approveId, setApproveId] = useState<string | null>(null);
  const [denyId, setDenyId] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState('');
  const [approveRole, setApproveRole] = useState<'user' | 'client'>('user');
  const [approveClientShortcode, setApproveClientShortcode] = useState('');
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  useEffect(() => {
    if (role !== 'admin') return;
    fetchRequests();
    fetchClients();
  }, [role]);

  const fetchRequests = async () => {
    try {
      const res = await fetch('/api/admin/requests', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.ok) setRequests(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const res = await fetch('/api/clients', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.ok) setClients(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const openApproveDialog = (id: string) => {
    setApproveId(id);
    setApproveRole('user');
    setApproveClientShortcode('');
    setTempPassword('');
  };

  const handleApprove = async () => {
    if (!approveId || !tempPassword) return;
    if (approveRole === 'client' && !approveClientShortcode) {
      setAlertMessage('Please select a client for a client account.');
      return;
    }

    const res = await fetch(`/api/admin/requests/${approveId}/approve`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({
        tempPassword,
        role: approveRole,
        clientShortcode: approveRole === 'client' ? approveClientShortcode : null,
      }),
    });

    if (res.ok) {
      const roleLabel = approveRole === 'client'
        ? `client account (${approveClientShortcode})`
        : 'liquid user account';
      setAlertMessage(`Approved as ${roleLabel}. Temp password: ${tempPassword}`);
      setApproveId(null);
      setTempPassword('');
      fetchRequests();
    } else {
      setAlertMessage('Failed to approve. Check that the client shortcode is valid.');
      setApproveId(null);
    }
  };

  const handleDeny = async () => {
    if (!denyId) return;

    const res = await fetch(`/api/admin/requests/${denyId}/deny`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });

    if (res.ok) {
      setDenyId(null);
      fetchRequests();
    } else {
      setAlertMessage('Failed to deny');
      setDenyId(null);
    }
  };

  if (role !== 'admin') {
    return <div className="p-8">Access Denied. Admins only.</div>;
  }

  return (
    <div className="flex flex-col w-full h-full min-h-[960px] bg-[#F7F9FB] p-8 pt-0">
      <h1 className="mb-6 text-3xl font-bold">Admin Panel</h1>

      <Tabs defaultValue="requests">
        <TabsList className="mb-4">
          <TabsTrigger value="requests">Access Requests</TabsTrigger>
          <TabsTrigger value="users">User Management</TabsTrigger>
        </TabsList>
        <TabsContent value="requests">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-center h-24">Loading...</TableCell></TableRow>
                ) : requests.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center h-24">No pending requests</TableCell></TableRow>
                ) : (
                  requests.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.email}</TableCell>
                      <TableCell>{r.usernameWanted}</TableCell>
                      <TableCell>{r.firstName} {r.lastName}</TableCell>
                      <TableCell>
                        <Badge variant={r.status === 'Pending' ? 'secondary' : r.status === 'Approved' ? 'default' : 'destructive'}>
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {r.status === 'Pending' && (
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => openApproveDialog(r.id)}>Approve</Button>
                            <Button size="sm" variant="outline" onClick={() => setDenyId(r.id)}>Deny</Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="users">
          <p className="text-muted-foreground">User management coming soon...</p>
        </TabsContent>
      </Tabs>

      <Dialog open={!!approveId} onOpenChange={(open) => !open && setApproveId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Approve Request</DialogTitle>
            <DialogDescription>Choose the account type and set a temporary password.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Account Type</Label>
              <Select value={approveRole} onValueChange={(v) => setApproveRole(v as 'user' | 'client')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Liquid User (full internal access)</SelectItem>
                  <SelectItem value="client">Client (scoped to one client)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {approveRole === 'client' && (
              <div className="space-y-2">
                <Label>Linked Client</Label>
                <Select value={approveClientShortcode} onValueChange={setApproveClientShortcode}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(c => (
                      <SelectItem key={c.shortcode} value={c.shortcode}>
                        {c.cadenceName} ({c.shortcode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Temporary Password</Label>
              <Input
                value={tempPassword}
                onChange={e => setTempPassword(e.target.value)}
                type="text"
                placeholder="Temporary Password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveId(null)}>Cancel</Button>
            <Button onClick={handleApprove} disabled={!tempPassword || (approveRole === 'client' && !approveClientShortcode)}>
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!denyId} onOpenChange={(open) => !open && setDenyId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deny Request</DialogTitle>
            <DialogDescription>Are you sure you want to deny this request?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDenyId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeny}>Deny</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!alertMessage} onOpenChange={(open) => !open && setAlertMessage(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notification</DialogTitle>
            <DialogDescription>{alertMessage}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setAlertMessage(null)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
