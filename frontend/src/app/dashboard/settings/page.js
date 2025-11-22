'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { toast } from 'sonner';
import { FiSave, FiSettings } from 'react-icons/fi';
import axios from 'axios';

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    HOSPITAL_NAME: '',
    FOOTER_TEXT: ''
  });

  useEffect(() => {
    checkAdminAccess();
    fetchSettings();
  }, []);

  const checkAdminAccess = () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.role !== 'ADMIN') {
      toast.error('Access denied. Admin only.');
      router.push('/dashboard');
    }
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

      const response = await axios.get(`${apiUrl}/settings?category=REPORT`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSettings({
        HOSPITAL_NAME: response.data.HOSPITAL_NAME || "l'EPH MAZOUNA",
        FOOTER_TEXT: response.data.FOOTER_TEXT || 'Cité Bousrour en face les pompiers Mazouna Relizane   Tel 0779 00 46 56   حي بوسرور مقابل الحماية المدنية مازونة غليزان'
      });
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      // Initialize defaults if not found
      await initializeDefaults();
    } finally {
      setLoading(false);
    }
  };

  const initializeDefaults = async () => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

      await axios.post(`${apiUrl}/settings/initialize`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      await fetchSettings();
    } catch (error) {
      console.error('Failed to initialize defaults:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

      // Update hospital name
      await axios.put(`${apiUrl}/settings/HOSPITAL_NAME`, {
        value: settings.HOSPITAL_NAME,
        category: 'REPORT',
        description: 'Hospital name displayed in reports'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Update footer text
      await axios.put(`${apiUrl}/settings/FOOTER_TEXT`, {
        value: settings.FOOTER_TEXT,
        category: 'REPORT',
        description: 'Footer text for reports (bilingual)'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading settings...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <FiSettings className="w-8 h-8 text-blue-600" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Report Settings</h1>
                  <p className="text-sm text-gray-600">Configure hospital information for exported reports</p>
                </div>
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn btn-primary"
              >
                <FiSave className="inline mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>

          {/* Settings Form */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Header & Footer Configuration</h2>

            {/* Hospital Name */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Hospital Name
                <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="text"
                value={settings.HOSPITAL_NAME}
                onChange={(e) => setSettings({ ...settings, HOSPITAL_NAME: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., l'EPH MAZOUNA"
              />
              <p className="mt-1 text-sm text-gray-500">
                This will appear in the report header: "Examen réalisé au niveau de [Hospital Name]"
              </p>
            </div>

            {/* Footer Text */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Footer Text (Bilingual - French/Arabic)
                <span className="text-red-500 ml-1">*</span>
              </label>
              <textarea
                value={settings.FOOTER_TEXT}
                onChange={(e) => setSettings({ ...settings, FOOTER_TEXT: e.target.value })}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                placeholder="e.g., Address   Tel   العنوان"
              />
              <p className="mt-1 text-sm text-gray-500">
                This appears at the bottom of all exported reports. Include address, phone, and Arabic translation.
              </p>
            </div>

            {/* Preview */}
            <div className="mt-8 border-t pt-6">
              <h3 className="text-md font-semibold text-gray-900 mb-4">Preview</h3>
              
              {/* Header Preview */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 mb-4 border-2 border-blue-200">
                <p className="text-lg font-bold text-center text-blue-900 mb-1">
                  INTERPRETATION DE TDM CEREBRALE
                </p>
                <p className="text-sm text-center font-semibold text-blue-800">
                  Examen réalisé au niveau de {settings.HOSPITAL_NAME || '[Hospital Name]'}
                </p>
              </div>

              {/* Footer Preview */}
              <div className="bg-gray-100 rounded-lg p-4 border-t-2 border-gray-400">
                <p className="text-xs text-center text-gray-600" style={{ direction: 'ltr' }}>
                  {settings.FOOTER_TEXT || '[Footer Text]'}
                </p>
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="mt-6 bg-blue-50 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">ℹ️ Important Notes:</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• These settings apply to all Word and PDF exports</li>
              <li>• Changes take effect immediately for new exports</li>
              <li>• Existing reports will not be modified</li>
              <li>• Only administrators can modify these settings</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
