import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

export function RequestAccessPage() {
  const [formData, setFormData] = useState({
    email: '',
    usernameWanted: '',
    firstName: '',
    lastName: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/users/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error('Failed to submit request');
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
        <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-sm text-center">
          <h1 className="mb-4 text-2xl font-bold text-green-600">Request Submitted</h1>
          <p className="mb-6">Your access request has been submitted and is pending admin approval.</p>
          <Button asChild><Link to="/login">Back to Login</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
      <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-sm">
        <h1 className="mb-6 text-2xl font-bold">Request Access</h1>
        {error && <div className="mb-4 rounded bg-destructive/15 p-3 text-sm text-destructive">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">Username Wanted</Label>
            <Input id="username" value={formData.usernameWanted} onChange={(e) => setFormData({...formData, usernameWanted: e.target.value})} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input id="firstName" value={formData.firstName} onChange={(e) => setFormData({...formData, firstName: e.target.value})} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input id="lastName" value={formData.lastName} onChange={(e) => setFormData({...formData, lastName: e.target.value})} required />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Submitting...' : 'Submit Request'}
          </Button>
        </form>
        <div className="mt-4 text-center text-sm">
          Already have an account? <Link to="/login" className="text-primary hover:underline">Login</Link>
        </div>
      </div>
    </div>
  );
}
