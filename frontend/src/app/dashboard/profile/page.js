'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import Navbar from '@/components/Navbar';
import TemplateEditor from '@/components/templates/TemplateEditor';
import { templatesAPI, authAPI } from '@/lib/api';
import { Plus, Edit2, Trash2, Star, Copy, FileText, X, Save, Lock } from 'lucide-react';

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState({ fullName: '' });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    modality: '',
    studyType: '',
    technique: '',
    findings: '',
    conclusion: '',
    isDefault: false
  });

  useEffect(() => {
    loadUserData();
    loadTemplates();
  }, []);

  const loadUserData = async () => {
    try {
      const response = await authAPI.getCurrentUser();
      setUser(response.data.user);
      setProfileData({ fullName: response.data.user.fullName });
    } catch (error) {
      console.error('Failed to load user data:', error);
      toast.error('Échec du chargement des données utilisateur');
    }
  };

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await templatesAPI.getAll();
      setTemplates(response.data);
    } catch (error) {
      console.error('Failed to load templates:', error);
      toast.error('Échec du chargement des modèles');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = () => {
    setEditingTemplate(null);
    setFormData({
      name: '',
      description: '',
      modality: '',
      studyType: '',
      technique: '',
      findings: '',
      conclusion: '',
      isDefault: false
    });
    setShowTemplateModal(true);
  };

  const handleEditTemplate = (template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || '',
      modality: template.modality || '',
      studyType: template.studyType || '',
      technique: template.technique || '',
      findings: template.findings || '',
      conclusion: template.conclusion || '',
      isDefault: template.isDefault || false
    });
    setShowTemplateModal(true);
  };

  const handleDuplicateTemplate = (template) => {
    setEditingTemplate(null);
    setFormData({
      name: `${template.name} (Copy)`,
      description: template.description || '',
      modality: template.modality || '',
      studyType: template.studyType || '',
      technique: template.technique || '',
      findings: template.findings || '',
      conclusion: template.conclusion || '',
      isDefault: false
    });
    setShowTemplateModal(true);
  };

  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    
    try {
      if (editingTemplate) {
        await templatesAPI.update(editingTemplate._id, formData);
        toast.success('Modèle mis à jour avec succès');
      } else {
        await templatesAPI.create(formData);
        toast.success('Modèle créé avec succès');
      }
      
      setShowTemplateModal(false);
      loadTemplates();
    } catch (error) {
      console.error('Failed to save template:', error);
      toast.error(error.response?.data?.error || 'Échec de l\'enregistrement du modèle');
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    
    try {
      await templatesAPI.delete(id);
      toast.success('Modèle supprimé avec succès');
      loadTemplates();
    } catch (error) {
      console.error('Failed to delete template:', error);
      toast.error('Échec de la suppression du modèle');
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    
    try {
      const response = await authAPI.updateProfile(profileData);
      setUser(response.data.user);
      
      // Update localStorage
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      storedUser.fullName = response.data.user.fullName;
      localStorage.setItem('user', JSON.stringify(storedUser));
      
      setEditingProfile(false);
      toast.success('Profil mis à jour avec succès');
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast.error(error.response?.data?.error || 'Échec de la mise à jour du profil');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('Les nouveaux mots de passe ne correspondent pas');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error('Le mot de passe doit comporter au moins 6 caractères');
      return;
    }
    
    try {
      await authAPI.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      
      setShowPasswordModal(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Mot de passe modifié avec succès');
    } catch (error) {
      console.error('Failed to change password:', error);
      toast.error(error.response?.data?.error || 'Échec du changement de mot de passe');
    }
  };

  // Extract plain text preview from HTML
  const getTextPreview = (html) => {
    if (!html) return '';
    const div = document.createElement('div');
    div.innerHTML = html;
    const text = div.textContent || div.innerText || '';
    return text.substring(0, 100) + (text.length > 100 ? '...' : '');
  };

  const modalityOptions = [
    'CT', 'MRI', 'X-RAY', 'ULTRASOUND', 'MAMMOGRAPHY', 'PET', 'NUCLEAR MEDICINE', 'OTHER'
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

return (
    <>
        <Navbar />
        <div className="p-6 max-w-7xl mx-auto">
        {/* User Info Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold text-gray-800">Profil</h1>
                <div className="flex space-x-2">
                    {!editingProfile && (
                        <button
                            onClick={() => setEditingProfile(true)}
                            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <Edit2 size={18} />
                            <span>Modifier le profil</span>
                        </button>
                    )}
                    <button
                        onClick={() => setShowPasswordModal(true)}
                        className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                        <Lock size={18} />
                        <span>Changer le mot de passe</span>
                    </button>
                </div>
            </div>

            {editingProfile ? (
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Nom Complet *
                        </label>
                        <input
                            type="text"
                            required
                            value={profileData.fullName}
                            onChange={(e) => setProfileData({ ...profileData, fullName: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Email (ne peut pas être modifié)
                        </label>
                        <input
                            type="email"
                            value={user?.email}
                            disabled
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Rôle
                        </label>
                        <span className={`px-3 py-1 rounded-full text-sm ${
                            user?.role === 'ADMIN' ? 'bg-red-100 text-red-700' : 
                            user?.role === 'VIEWER' ? 'bg-gray-100 text-gray-700' :
                            'bg-blue-100 text-blue-700'
                        }`}>
                            {user?.role}
                        </span>
                    </div>
                    <div className="flex space-x-3">
                        <button
                            type="submit"
                            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                            <Save size={18} />
                            <span>Enregistrer les modifications</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setEditingProfile(false);
                                setProfileData({ fullName: user?.fullName });
                            }}
                            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            Annuler
                        </button>
                    </div>
                </form>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm text-gray-600">Nom complet</label>
                        <p className="text-lg font-semibold">{user?.fullName}</p>
                    </div>
                    <div>
                        <label className="text-sm text-gray-600">Email</label>
                        <p className="text-lg font-semibold">{user?.email}</p>
                    </div>
                    <div>
                        <label className="text-sm text-gray-600">Rôle</label>
                        <p className="text-lg font-semibold">
                            <span className={`px-3 py-1 rounded-full text-sm ${
                                user?.role === 'ADMIN' ? 'bg-red-100 text-red-700' : 
                                user?.role === 'VIEWER' ? 'bg-gray-100 text-gray-700' :
                                'bg-blue-100 text-blue-700'
                            }`}>
                                {user?.role}
                            </span>
                        </p>
                    </div>
                </div>
            )}
        </div>

        {/* Templates Section - Only for Radiologists and Admins */}
        {user?.role !== 'VIEWER' && (
            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Modèles de Rapport</h2>
                        <p className="text-sm text-gray-600 mt-1">
                            Créez et gérez vos modèles de rapport pour une saisie plus rapide
                        </p>
                    </div>
                    <button
                        onClick={handleCreateTemplate}
                        className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <Plus size={20} />
                        <span>Nouveau Modèle</span>
                    </button>
                </div>

                {templates.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-lg">
                        <FileText size={48} className="mx-auto text-gray-400 mb-4" />
                        <p className="text-gray-600 mb-4">Aucun modèle pour le moment</p>
                        <button
                            onClick={handleCreateTemplate}
                            className="text-blue-600 hover:text-blue-700 font-medium"
                        >
                            Créer votre premier modèle
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {templates.map((template) => (
                            <div
                                key={template._id}
                                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-2">
                                            <h3 className="font-semibold text-gray-800">{template.name}</h3>
                                            {template.isDefault && (
                                                <Star size={16} className="text-yellow-500 fill-yellow-500" />
                                            )}
                                        </div>
                                        {template.modality && (
                                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded mt-1 inline-block">
                                                {template.modality}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                
                                {template.description && (
                                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                                        {template.description}
                                    </p>
                                )}
                                
                                {/* Preview of template content */}
                                <div className="text-xs text-gray-500 mb-3 bg-gray-50 p-2 rounded">
                                    <div className="line-clamp-3">
                                        {template.technique && <span className="text-blue-600">T: {getTextPreview(template.technique)} </span>}
                                        {template.findings && <span className="text-gray-700">F: {getTextPreview(template.findings)} </span>}
                                        {template.conclusion && <span className="text-green-600">C: {getTextPreview(template.conclusion)}</span>}
                                    </div>
                                </div>
                                
                                <div className="text-xs text-gray-500 mb-3">
                                    Utilisé {template.usageCount} fois
                                </div>
                                
                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={() => handleEditTemplate(template)}
                                        className="flex-1 flex items-center justify-center space-x-1 text-blue-600 hover:bg-blue-50 py-2 rounded transition-colors"
                                    >
                                        <Edit2 size={14} />
                                        <span className="text-sm">Modifier</span>
                                    </button>
                                    <button
                                        onClick={() => handleDuplicateTemplate(template)}
                                        className="flex-1 flex items-center justify-center space-x-1 text-green-600 hover:bg-green-50 py-2 rounded transition-colors"
                                    >
                                        <Copy size={14} />
                                        <span className="text-sm">Dupliquer</span>
                                    </button>
                                    <button
                                        onClick={() => handleDeleteTemplate(template._id)}
                                        className="flex-1 flex items-center justify-center space-x-1 text-red-600 hover:bg-red-50 py-2 rounded transition-colors"
                                    >
                                        <Trash2 size={14} />
                                        <span className="text-sm">Supprimer</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}

        {/* Template Modal */}
        {showTemplateModal && (
            <div 
                className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto"
                onClick={() => setShowTemplateModal(false)}
            >
                <div 
                    className="bg-white rounded-lg max-w-7xl w-full my-8"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center rounded-t-lg z-10">
                        <h3 className="text-xl font-bold">
                            {editingTemplate ? 'Modifier le modèle' : 'Créer un nouveau modèle'}
                        </h3>
                        <button
                            onClick={() => setShowTemplateModal(false)}
                            className="text-gray-500 hover:text-gray-700"
                        >
                            <X size={24} />
                        </button>
                    </div>
                    
                    <form onSubmit={handleSaveTemplate} className="p-6 max-h-[calc(90vh-120px)] overflow-y-auto">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Nom du Modèle *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="ex: TDM Cérébral Standard"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Modalité
                                </label>
                                <select
                                    value={formData.modality}
                                    onChange={(e) => setFormData({ ...formData, modality: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value="">Sélectionner la modalité</option>
                                    {modalityOptions.map(mod => (
                                        <option key={mod} value={mod}>{mod}</option>
                                    ))}
                                </select>
                            </div>
                            
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Description
                                </label>
                                <input
                                    type="text"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Brève description de ce modèle"
                                />
                            </div>
                            
                            <div className="md:col-span-2">
                                <label className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        checked={formData.isDefault}
                                        onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                                        className="rounded text-blue-600 focus:ring-2 focus:ring-blue-500"
                                    />
                                    <span className="text-sm font-medium text-gray-700">
                                        Définir comme modèle par défaut pour cette modalité
                                    </span>
                                </label>
                            </div>
                        </div>

                        {/* Three Sections with Rich Text Editor */}
                        <div className="mt-6">
                            <label className="block text-sm font-medium text-gray-700 mb-3">
                                Contenu du Modèle (Éditeur de Texte Enrichi)
                            </label>
                            <TemplateEditor
                                initialTechnique={formData.technique}
                                initialFindings={formData.findings}
                                initialConclusion={formData.conclusion}
                                onChange={(data) => {
                                    setFormData({
                                        ...formData,
                                        technique: data.technique,
                                        findings: data.findings,
                                        conclusion: data.conclusion
                                    });
                                }}
                            />
                        </div>

                        <div className="flex justify-end space-x-3 mt-6">
                            <button
                                type="button"
                                onClick={() => setShowTemplateModal(false)}
                                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Annuler
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                {editingTemplate ? 'Mettre à jour le modèle' : 'Créer le modèle'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        {/* Password Change Modal */}
        {showPasswordModal && (
            <div 
                className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
                onClick={() => {
                    setShowPasswordModal(false);
                    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                }}
            >
                <div 
                    className="bg-white rounded-lg max-w-md w-full"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center rounded-t-lg">
                        <h3 className="text-xl font-bold">Changer le mot de passe</h3>
                        <button
                            onClick={() => {
                                setShowPasswordModal(false);
                                setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                            }}
                            className="text-gray-500 hover:text-gray-700"
                        >
                            <X size={24} />
                        </button>
                    </div>
                    
                    <form onSubmit={handleChangePassword} className="p-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Mot de passe actuel *
                                </label>
                                <input
                                    type="password"
                                    required
                                    value={passwordData.currentPassword}
                                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Entrez le mot de passe actuel"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Nouveau mot de passe * (min. 6 caractères)
                                </label>
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    value={passwordData.newPassword}
                                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Entrez le nouveau mot de passe"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Confirmer le nouveau mot de passe *
                                </label>
                                <input
                                    type="password"
                                    required
                                    value={passwordData.confirmPassword}
                                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Confirmer le nouveau mot de passe"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end space-x-3 mt-6">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowPasswordModal(false);
                                    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                                }}
                                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Annuler
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Changer le mot de passe
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}
    </div>
    </>
);
}
