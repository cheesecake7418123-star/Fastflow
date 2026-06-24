import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { User, Shield } from 'lucide-react';

const ROLE_INFO = {
  admin: { label: 'Admin', color: 'text-red-600 bg-red-50 border-red-200', desc: 'Full access: create/delete projects, manage all users, access all tasks.' },
  manager: { label: 'Manager', color: 'text-amber-600 bg-amber-50 border-amber-200', desc: 'Can create projects, add tasks, assign to users, view all tasks.' },
  user: { label: 'User', color: 'text-blue-600 bg-blue-50 border-blue-200', desc: 'Can view and update tasks assigned to them.' },
};

export default function SettingsPage() {
  const { profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const { error } = await supabase.from('profiles').update({ full_name: fullName, updated_at: new Date().toISOString() }).eq('id', profile!.id);
    setSaving(false);
    if (error) { setError(error.message); return; }
    await refreshProfile();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (!profile) return null;

  const roleInfo = ROLE_INFO[profile.role];

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

        {/* Profile */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <User className="w-4 h-4" /> Profile
          </h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
              <input
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                disabled
                value={profile.id}
                className="w-full px-3 py-2 border border-gray-100 rounded-lg text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
            </button>
          </form>
        </div>

        {/* Role */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4" /> Role & Permissions
          </h2>
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-semibold ${roleInfo.color}`}>
            <Shield className="w-3.5 h-3.5" />
            {roleInfo.label}
          </div>
          <p className="text-sm text-gray-500 mt-3">{roleInfo.desc}</p>
        </div>
      </div>
    </div>
  );
}
