import { useState, useEffect } from 'react';
import { Plus, Users, FileText, LogOut, Upload } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { ClientManager } from './ClientManager';
import { InvoiceViewer } from './InvoiceViewer';
import { InvoiceUpload } from './InvoiceUpload';

interface DashboardProps {
  accessToken: string;
  onLogout: () => void;
}

export function Dashboard({ accessToken, onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<'clients' | 'invoices' | 'upload'>('clients');
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      // Try temporary admin endpoint first (no auth issues)
      const fallbackResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-97c553b8/admin/list-clients`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json();
        console.log('Clients loaded:', fallbackData);
        setClients(fallbackData.clients || []);
      } else {
        const errorText = await fallbackResponse.text();
        console.error('Failed to load clients. Status:', fallbackResponse.status, 'Response:', errorText);
      }
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClientCreated = () => {
    loadClients();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">LO Accountants</h1>
              <p className="text-sm text-gray-600">Invoice Capture Dashboard</p>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-8">
            <button
              onClick={() => setActiveTab('clients')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'clients'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Clients
              </div>
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'upload'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Upload Invoices
              </div>
            </button>
            <button
              onClick={() => setActiveTab('invoices')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'invoices'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                View Invoices
              </div>
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'clients' && (
          <ClientManager
            accessToken={accessToken}
            clients={clients}
            onClientCreated={handleClientCreated}
            onClientSelect={setSelectedClient}
          />
        )}

        {activeTab === 'upload' && (
          <InvoiceUpload
            accessToken={accessToken}
            clients={clients}
          />
        )}

        {activeTab === 'invoices' && (
          <InvoiceViewer
            accessToken={accessToken}
            clients={clients}
          />
        )}
      </main>
    </div>
  );
}
