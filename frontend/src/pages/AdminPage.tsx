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

type UserRole = 'staff' | 'client' | 'external' | 'admin';

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

interface UserSummary {
  id: string;
  email: string;
  role: string;
  clientShortcode?: string;
  firstName?: string;
  lastName?: string;
  createdAt?: string;
}

const ROLE_LABELS: Record<string, string> = {
  staff: 'Staff',
  admin: 'Admin',
  client: 'Client',
  external: 'Broker',
};

const roleBadgeVariant = (role: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (role === 'admin') return 'destructive';
  if (role === 'staff') return 'default';
  if (role === 'external') return 'secondary';
  return 'outline';
};

interface RolePickerProps {
  value: UserRole;
  onChange: (v: UserRole) => void;
  clients: ClientOption[];
  clientShortcode: string;
  onClientShortcodeChange: (v: string) => void;
}

function RolePicker({ value, onChange, clients, clientShortcode, onClientShortcodeChange }: RolePickerProps) {
  return (
    <>
      <div className="space-y-2">
        <Label>Account Type</Label>
        <Select value={value} onValueChange={(v) => onChange(v as UserRole)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="staff">Staff (full internal access)</SelectItem>
            <SelectItem value="external">Broker (external portal)</SelectItem>
            <SelectItem value="client">Client (scoped to one client)</SelectItem>
            <SelectItem value="admin">Admin (user management only)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {value === 'client' && (
        <div className="space-y-2">
          <Label>Linked Client</Label>
          <Select value={clientShortcode} onValueChange={onClientShortcodeChange}>
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
    </>
  );
}

export function AdminPage() {
  const { session, role } = useAuth();
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [clients, setClients] = useState<ClientOption[]>([]);

  // Approve dialog
  const [approveId, setApproveId] = useState<string | null>(null);
  const [denyId, setDenyId] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState('');
  const [approveRole, setApproveRole] = useState<UserRole>('staff');
  const [approveClientShortcode, setApproveClientShortcode] = useState('');

  // Create user dialog
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createFirstName, setCreateFirstName] = useState('');
  const [createLastName, setCreateLastName] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createRole, setCreateRole] = useState<UserRole>('staff');
  const [createClientShortcode, setCreateClientShortcode] = useState('');
  const [createClientMode, setCreateClientMode] = useState<'existing' | 'new'>('existing');
  const emptyNewClient = { shortcode: '', cadenceName: '', code: '', email: '', phone: '', city: '', province: '', postalCode: '', language: '', notes: '', active: true, dnc: false };
  const [newClientForm, setNewClientForm] = useState(emptyNewClient);

  // Edit user dialog
  const [editUser, setEditUser] = useState<UserSummary | null>(null);
  const [editRole, setEditRole] = useState<UserRole>('staff');
  const [editClientShortcode, setEditClientShortcode] = useState('');
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');

  // Reset password dialog
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState('');

  // Delete dialog
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);

  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const authHeaders = { Authorization: `Bearer ${session?.access_token}` };

  useEffect(() => {
    if (role !== 'admin') return;
    fetchRequests();
    fetchClients();
  }, [role]);

  const fetchRequests = async () => {
    try {
      const res = await fetch('/api/admin/requests', { headers: authHeaders });
      if (res.ok) setRequests(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoadingRequests(false); }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch('/api/admin/users', { headers: authHeaders });
      if (res.ok) setUsers(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoadingUsers(false); }
  };

  const fetchClients = async () => {
    try {
      const res = await fetch('/api/clients', { headers: authHeaders });
      if (res.ok) setClients(await res.json());
    } catch (e) { console.error(e); }
  };

  const openApproveDialog = (id: string) => {
    setApproveId(id);
    setApproveRole('staff');
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
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ tempPassword, role: approveRole, clientShortcode: approveRole === 'client' ? approveClientShortcode : null }),
    });
    if (res.ok) {
      setAlertMessage(`Approved as ${ROLE_LABELS[approveRole] ?? approveRole}${approveRole === 'client' ? ` (${approveClientShortcode})` : ''}. Temp password: ${tempPassword}`);
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
    const res = await fetch(`/api/admin/requests/${denyId}/deny`, { method: 'PATCH', headers: authHeaders });
    if (res.ok) { setDenyId(null); fetchRequests(); }
    else { setAlertMessage('Failed to deny'); setDenyId(null); }
  };

  const resetCreateDialog = () => {
    setCreateEmail(''); setCreateFirstName(''); setCreateLastName('');
    setCreatePassword(''); setCreateRole('staff'); setCreateClientShortcode('');
    setCreateClientMode('existing'); setNewClientForm(emptyNewClient);
  };

  const handleCreateUser = async () => {
    if (!createEmail || !createPassword) return;
    if (createRole === 'client') {
      if (createClientMode === 'existing' && !createClientShortcode) {
        setAlertMessage('Please select a client.');
        return;
      }
      if (createClientMode === 'new') {
        if (!newClientForm.shortcode.trim()) { setAlertMessage('Account # is required for new client.'); return; }
        if (!newClientForm.cadenceName.trim()) { setAlertMessage('Name is required for new client.'); return; }
      }
    }

    const body: Record<string, unknown> = {
      email: createEmail, tempPassword: createPassword, role: createRole,
      firstName: createFirstName, lastName: createLastName,
    };

    if (createRole === 'client') {
      if (createClientMode === 'new') {
        body.newClient = {
          shortcode: newClientForm.shortcode.trim(),
          cadenceName: newClientForm.cadenceName.trim(),
          code: newClientForm.code.trim() || null,
          email: newClientForm.email.trim() || null,
          phone: newClientForm.phone.trim() || null,
          city: newClientForm.city.trim() || null,
          province: newClientForm.province.trim() || null,
          postalCode: newClientForm.postalCode.trim() || null,
          language: newClientForm.language.trim() || null,
          notes: newClientForm.notes.trim() || null,
          active: newClientForm.active,
          dnc: newClientForm.dnc,
        };
      } else {
        body.clientShortcode = createClientShortcode;
      }
    }

    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const label = createRole === 'client' && createClientMode === 'new'
        ? `New client "${newClientForm.cadenceName}" and login created.`
        : 'User created.';
      setAlertMessage(`${label} Temp password: ${createPassword}`);
      setShowCreateUser(false);
      resetCreateDialog();
      fetchUsers();
      if (createRole === 'client') fetchClients();
    } else {
      const err = await res.json().catch(() => ({}));
      setAlertMessage(err.message ?? 'Failed to create user.');
    }
  };

  const openEditDialog = (u: UserSummary) => {
    setEditUser(u);
    setEditRole((u.role as UserRole) || 'staff');
    setEditClientShortcode(u.clientShortcode ?? '');
    setEditFirstName(u.firstName ?? '');
    setEditLastName(u.lastName ?? '');
  };

  const handleEditUser = async () => {
    if (!editUser) return;
    if (editRole === 'client' && !editClientShortcode) {
      setAlertMessage('Please select a client.');
      return;
    }
    const res = await fetch(`/api/admin/users/${editUser.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ role: editRole, clientShortcode: editRole === 'client' ? editClientShortcode : null, firstName: editFirstName, lastName: editLastName }),
    });
    if (res.ok) { setEditUser(null); fetchUsers(); }
    else { setAlertMessage('Failed to update user.'); }
  };

  const handleResetPassword = async () => {
    if (!resetUserId || !resetPassword) return;
    const res = await fetch(`/api/admin/users/${resetUserId}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ tempPassword: resetPassword }),
    });
    if (res.ok) {
      setAlertMessage(`Password reset. Temp password: ${resetPassword}`);
      setResetUserId(null); setResetPassword('');
    } else {
      setAlertMessage('Failed to reset password.');
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserId) return;
    const res = await fetch(`/api/admin/users/${deleteUserId}`, { method: 'DELETE', headers: authHeaders });
    if (res.ok) { setDeleteUserId(null); fetchUsers(); }
    else { setAlertMessage('Failed to delete user.'); setDeleteUserId(null); }
  };

  if (role !== 'admin') {
    return <div className="p-8">Access Denied. Admins only.</div>;
  }

  return (
    <div className="flex flex-col w-full h-full min-h-[960px] bg-[#F7F9FB] p-8 pt-0">
      <h1 className="mb-6 text-3xl font-bold">Admin Panel</h1>

      <Tabs defaultValue="users">
        <TabsList className="mb-4">
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="requests">Access Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <div className="flex justify-end mb-3">
            <Button onClick={() => { setShowCreateUser(true); if (users.length === 0) fetchUsers(); }}>
              Create User
            </Button>
          </div>
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingUsers ? (
                  <TableRow><TableCell colSpan={5} className="text-center h-24">Loading...</TableCell></TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                      Click "Create User" to load users or add a new one.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map(u => (
                    <TableRow key={u.id}>
                      <TableCell className="font-mono text-sm">{u.email}</TableCell>
                      <TableCell>{[u.firstName, u.lastName].filter(Boolean).join(' ') || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={roleBadgeVariant(u.role)}>{ROLE_LABELS[u.role] ?? u.role}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u.clientShortcode ?? '—'}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEditDialog(u)}>Edit</Button>
                          <Button size="sm" variant="outline" onClick={() => { setResetUserId(u.id); setResetPassword(''); }}>Reset PW</Button>
                          <Button size="sm" variant="destructive" onClick={() => setDeleteUserId(u.id)}>Delete</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {users.length === 0 && !loadingUsers && (
            <div className="mt-2 flex justify-center">
              <Button variant="outline" size="sm" onClick={fetchUsers}>Load Users</Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="requests">
          <div className="rounded-md border bg-white">
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
                {loadingRequests ? (
                  <TableRow><TableCell colSpan={5} className="text-center h-24">Loading...</TableCell></TableRow>
                ) : requests.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center h-24">No access requests</TableCell></TableRow>
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
      </Tabs>

      {/* Approve Request Dialog */}
      <Dialog open={!!approveId} onOpenChange={(open) => !open && setApproveId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Approve Request</DialogTitle>
            <DialogDescription>Choose the account type and set a temporary password.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <RolePicker value={approveRole} onChange={setApproveRole} clients={clients}
              clientShortcode={approveClientShortcode} onClientShortcodeChange={setApproveClientShortcode} />
            <div className="space-y-2">
              <Label>Temporary Password</Label>
              <Input value={tempPassword} onChange={e => setTempPassword(e.target.value)} type="text" placeholder="Temporary Password" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveId(null)}>Cancel</Button>
            <Button onClick={handleApprove} disabled={!tempPassword || (approveRole === 'client' && !approveClientShortcode)}>Approve</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deny Dialog */}
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

      {/* Create User Dialog */}
      <Dialog open={showCreateUser} onOpenChange={(open) => { if (!open) { setShowCreateUser(false); resetCreateDialog(); } }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create User</DialogTitle>
            <DialogDescription>Create a new user account directly.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input value={createFirstName} onChange={e => setCreateFirstName(e.target.value)} placeholder="First" />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input value={createLastName} onChange={e => setCreateLastName(e.target.value)} placeholder="Last" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={createEmail} onChange={e => setCreateEmail(e.target.value)} type="email" placeholder="user@example.com" />
            </div>

            {/* Role picker — but if client, we handle the client section ourselves */}
            <div className="space-y-2">
              <Label>Account Type</Label>
              <Select value={createRole} onValueChange={(v) => { setCreateRole(v as UserRole); setCreateClientMode('existing'); setNewClientForm(emptyNewClient); setCreateClientShortcode(''); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff (full internal access)</SelectItem>
                  <SelectItem value="external">Broker (external portal)</SelectItem>
                  <SelectItem value="client">Client (scoped to one client)</SelectItem>
                  <SelectItem value="admin">Admin (user management only)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {createRole === 'client' && (
              <div className="space-y-3 rounded-md border p-3 bg-muted/20">
                {/* Mode toggle */}
                <div className="flex gap-2">
                  <Button
                    type="button" size="sm"
                    variant={createClientMode === 'existing' ? 'default' : 'outline'}
                    onClick={() => setCreateClientMode('existing')}
                  >Link existing client</Button>
                  <Button
                    type="button" size="sm"
                    variant={createClientMode === 'new' ? 'default' : 'outline'}
                    onClick={() => setCreateClientMode('new')}
                  >Create new client</Button>
                </div>

                {createClientMode === 'existing' ? (
                  <div className="space-y-2">
                    <Label>Linked Client</Label>
                    <Select value={createClientShortcode} onValueChange={setCreateClientShortcode}>
                      <SelectTrigger><SelectValue placeholder="Select a client..." /></SelectTrigger>
                      <SelectContent>
                        {clients.map(c => (
                          <SelectItem key={c.shortcode} value={c.shortcode}>{c.cadenceName} ({c.shortcode})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">A new client record will be created and linked to this login.</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Account # <span className="text-destructive">*</span></Label>
                        <Input value={newClientForm.shortcode} onChange={e => setNewClientForm(p => ({ ...p, shortcode: e.target.value }))} placeholder="e.g. 5545" />
                      </div>
                      <div className="space-y-1">
                        <Label>Alpha Code</Label>
                        <Input value={newClientForm.code} onChange={e => setNewClientForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} placeholder="e.g. SAF" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>Name <span className="text-destructive">*</span></Label>
                      <Input value={newClientForm.cadenceName} onChange={e => setNewClientForm(p => ({ ...p, cadenceName: e.target.value }))} placeholder="e.g. ACME Corp" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Email</Label>
                        <Input type="email" value={newClientForm.email} onChange={e => setNewClientForm(p => ({ ...p, email: e.target.value }))} placeholder="client@example.com" />
                      </div>
                      <div className="space-y-1">
                        <Label>Phone</Label>
                        <Input value={newClientForm.phone} onChange={e => setNewClientForm(p => ({ ...p, phone: e.target.value }))} placeholder="(555) 000-0000" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>City</Label>
                        <Input value={newClientForm.city} onChange={e => setNewClientForm(p => ({ ...p, city: e.target.value }))} placeholder="City" />
                      </div>
                      <div className="space-y-1">
                        <Label>Province</Label>
                        <Input value={newClientForm.province} onChange={e => setNewClientForm(p => ({ ...p, province: e.target.value }))} placeholder="Province" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Postal Code</Label>
                        <Input value={newClientForm.postalCode} onChange={e => setNewClientForm(p => ({ ...p, postalCode: e.target.value }))} placeholder="A1A 1A1" />
                      </div>
                      <div className="space-y-1">
                        <Label>Language</Label>
                        <Input value={newClientForm.language} onChange={e => setNewClientForm(p => ({ ...p, language: e.target.value }))} placeholder="EN / FR" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>Notes</Label>
                      <textarea
                        value={newClientForm.notes}
                        onChange={e => setNewClientForm(p => ({ ...p, notes: e.target.value }))}
                        className="w-full min-h-[60px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        placeholder="Notes"
                      />
                    </div>
                    <div className="flex gap-6">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={newClientForm.active} onChange={e => setNewClientForm(p => ({ ...p, active: e.target.checked }))} className="h-4 w-4 rounded border-gray-300" />
                        Active
                      </label>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={newClientForm.dnc} onChange={e => setNewClientForm(p => ({ ...p, dnc: e.target.checked }))} className="h-4 w-4 rounded border-gray-300 text-red-600" />
                        DNC
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Temporary Password</Label>
              <Input value={createPassword} onChange={e => setCreatePassword(e.target.value)} type="text" placeholder="Temporary Password" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateUser(false); resetCreateDialog(); }}>Cancel</Button>
            <Button
              onClick={handleCreateUser}
              disabled={
                !createEmail || !createPassword ||
                (createRole === 'client' && createClientMode === 'existing' && !createClientShortcode) ||
                (createRole === 'client' && createClientMode === 'new' && (!newClientForm.shortcode.trim() || !newClientForm.cadenceName.trim()))
              }
            >Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>{editUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input value={editFirstName} onChange={e => setEditFirstName(e.target.value)} placeholder="First" />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input value={editLastName} onChange={e => setEditLastName(e.target.value)} placeholder="Last" />
              </div>
            </div>
            <RolePicker value={editRole} onChange={setEditRole} clients={clients}
              clientShortcode={editClientShortcode} onClientShortcodeChange={setEditClientShortcode} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button onClick={handleEditUser} disabled={editRole === 'client' && !editClientShortcode}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetUserId} onOpenChange={(open) => !open && setResetUserId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>Set a new temporary password. The user will be required to change it on next login.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>New Temporary Password</Label>
            <Input value={resetPassword} onChange={e => setResetPassword(e.target.value)} type="text" placeholder="Temporary Password" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetUserId(null)}>Cancel</Button>
            <Button onClick={handleResetPassword} disabled={!resetPassword}>Reset</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteUserId} onOpenChange={(open) => !open && setDeleteUserId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>This will permanently delete the Supabase account. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUserId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteUser}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alert Dialog */}
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
