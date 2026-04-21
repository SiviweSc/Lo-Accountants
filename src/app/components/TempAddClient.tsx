import { useState } from 'react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { getSupabaseClient } from '../../utils/supabaseClient';

export function TempAddClient({ onClientAdded }: { onClientAdded: () => void }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const addOrbiconProjects = async () => {
    setLoading(true);
    setMessage('');

    try {
      // Get current user
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setMessage('Not logged in');
        setLoading(false);
        return;
      }

      const userId = session.user.id;

      // Call admin endpoint
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-97c553b8/admin/add-client`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            name: 'Orbicon Projects',
            vatRegistered: true,
            userId: userId
          })
        }
      );

      const data = await response.json();

      if (response.ok) {
        setMessage('✓ Orbicon Projects added successfully!');
        setTimeout(() => {
          onClientAdded();
        }, 1000);
      } else {
        setMessage(`Error: ${data.error || 'Failed to add client'}`);
      }
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
      <h3 className="font-medium text-yellow-900 mb-2">Temporary Workaround</h3>
      <p className="text-sm text-yellow-800 mb-3">
        Click below to manually add "Orbicon Projects" client:
      </p>
      <button
        onClick={addOrbiconProjects}
        disabled={loading}
        className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Adding...' : 'Add Orbicon Projects'}
      </button>
      {message && (
        <p className="mt-2 text-sm text-yellow-900">{message}</p>
      )}
    </div>
  );
}
