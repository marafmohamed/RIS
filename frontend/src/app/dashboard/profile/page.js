'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import Navbar from '@/components/Navbar';
import TemplateEditor from '@/components/templates/TemplateEditor';
import { templatesAPI, authAPI, usersAPI } from '@/lib/api';
import { Plus, Edit2, Trash2, Star, Copy, FileText, X, Save, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ProfilePage() {
    const [user, setUser] = useState(null);
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [radiologists, setRadiologists] = useState([]);
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
        findings: '',
        conclusion: '',
        triggerWord: '',
        isDefault: false,
        sharedWith: []
    });

    useEffect(() => {
        loadUserData();
        loadTemplates();
        loadRadiologists();
    }, []);

    const loadRadiologists = async () => {
        try {
            const response = await usersAPI.getRadiologists();
            setRadiologists(response.data);
        } catch (error) {
            console.error('Failed to load radiologists:', error);
        }
    };

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
            triggerWord: '',
            isDefault: false,
            sharedWith: []
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
            findings: template.findings || '',
            conclusion: template.conclusion || '',
            triggerWord: template.triggerWord || '',
            isDefault: template.isDefault || false,
            sharedWith: template.sharedWith || []
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
            findings: template.findings || '',
            conclusion: template.conclusion || '',
            triggerWord: '',
            isDefault: false,
            sharedWith: []
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
            <div className="min-h-screen bg-gray-50">
                <Navbar />
                <div className="flex items-center justify-center h-[calc(100vh-64px)]">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

                {/* Header Section */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Mon Profil</h1>
                    <p className="mt-2 text-gray-600">Gérez vos informations personnelles et vos préférences</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: User Info */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-8 text-center">
                                <div className="w-24 h-24 bg-white rounded-full mx-auto flex items-center justify-center text-3xl font-bold text-blue-600 shadow-lg mb-4">
                                    {user?.fullName?.charAt(0) || 'U'}
                                </div>
                                <h2 className="text-xl font-bold text-white">{user?.fullName}</h2>
                                <p className="text-blue-100 text-sm mt-1">{user?.email}</p>
                                <div className="mt-4">
                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${user?.role === 'ADMIN' ? 'bg-red-500 text-white' :
                                        user?.role === 'VIEWER' ? 'bg-gray-500 text-white' :
                                            'bg-blue-500 text-white border border-blue-400'
                                        }`}>
                                        {user?.role}
                                    </span>
                                </div>
                            </div>

                            <div className="p-6 space-y-4">
                                {!editingProfile ? (
                                    <button
                                        onClick={() => setEditingProfile(true)}
                                        className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                                    >
                                        <Edit2 size={18} />
                                        <span>Modifier le profil</span>
                                    </button>
                                ) : (
                                    <form onSubmit={handleUpdateProfile} className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Nom Complet
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                value={profileData.fullName}
                                                onChange={(e) => setProfileData({ ...profileData, fullName: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                            />
                                        </div>
                                        <div className="flex space-x-2">
                                            <button
                                                type="submit"
                                                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
                                            >
                                                Enregistrer
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditingProfile(false);
                                                    setProfileData({ fullName: user?.fullName });
                                                }}
                                                className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 text-sm font-medium"
                                            >
                                                Annuler
                                            </button>
                                        </div>
                                    </form>
                                )}

                                <button
                                    onClick={() => setShowPasswordModal(true)}
                                    className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                                >
                                    <Lock size={18} />
                                    <span>Changer le mot de passe</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Templates (if applicable) */}
                    <div className="lg:col-span-2">
                        {user?.role !== 'VIEWER' && (
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                                <div className="flex justify-between items-center mb-6">
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900">Modèles de Rapport</h2>
                                        <p className="text-sm text-gray-500 mt-1">Gérez vos modèles pour une rédaction plus rapide</p>
                                    </div>
                                    <button
                                        onClick={handleCreateTemplate}
                                        className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                                    >
                                        <Plus size={20} />
                                        <span className="font-medium">Nouveau</span>
                                    </button>
                                </div>

                                {templates.length === 0 ? (
                                    <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                                        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <FileText size={32} className="text-blue-500" />
                                        </div>
                                        <h3 className="text-lg font-medium text-gray-900">Aucun modèle</h3>
                                        <p className="text-gray-500 mb-6 max-w-sm mx-auto">Créez des modèles prédéfinis pour accélérer la rédaction de vos rapports radiologiques.</p>
                                        <button
                                            onClick={handleCreateTemplate}
                                            className="text-blue-600 hover:text-blue-700 font-medium hover:underline"
                                        >
                                            Créer votre premier modèle
                                        </button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <AnimatePresence>
                                            {templates.map((template) => (
                                                <motion.div
                                                    layoutId={`card-${template._id}`}
                                                    key={template._id}
                                                    onDoubleClick={() => handleEditTemplate(template)}
                                                    className="group border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all duration-200 bg-white hover:border-blue-200 cursor-pointer"
                                                    initial={{ opacity: 0, scale: 0.9 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    exit={{ opacity: 0, scale: 0.9 }}
                                                    transition={{ duration: 0.2 }}
                                                >
                                                    <div className="flex items-start justify-between mb-3">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center space-x-2">
                                                                <motion.h3 layoutId={`title-${template._id}`} className="font-semibold text-gray-900 truncate">{template.name}</motion.h3>
                                                                {template.isDefault && (
                                                                    <Star size={14} className="text-yellow-400 fill-yellow-400 flex-shrink-0" />
                                                                )}
                                                            </div>
                                                            {template.modality && (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 mt-1">
                                                                    {template.modality}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleEditTemplate(template); }}
                                                                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                                title="Modifier"
                                                            >
                                                                <Edit2 size={16} />
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleDuplicateTemplate(template); }}
                                                                className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                                title="Dupliquer"
                                                            >
                                                                <Copy size={16} />
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(template._id); }}
                                                                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                title="Supprimer"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {template.description && (
                                                        <p className="text-sm text-gray-600 mb-3 line-clamp-2 h-10">
                                                            {template.description}
                                                        </p>
                                                    )}

                                                    <div className="flex items-center justify-between pt-3 border-t border-gray-50 mt-2">
                                                        <span className="text-xs text-gray-400">
                                                            Utilisé {template.usageCount} fois
                                                        </span>
                                                        <span className="text-xs text-gray-400">
                                                            {new Date(template.updatedAt || Date.now()).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Template Modal */}
                <AnimatePresence>
                    {showTemplateModal && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto"
                            onClick={() => setShowTemplateModal(false)}
                        >
                            <motion.div
                                layoutId={editingTemplate?._id ? `card-${editingTemplate._id}` : undefined}
                                className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full my-8 transform overflow-hidden"
                                onClick={(e) => e.stopPropagation()}
                                initial={!editingTemplate ? { opacity: 0, scale: 0.9, y: 20 } : undefined}
                                animate={!editingTemplate ? { opacity: 1, scale: 1, y: 0 } : undefined}
                                exit={!editingTemplate ? { opacity: 0, scale: 0.9, y: 20 } : undefined}
                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            >
                                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                                    <motion.h3 layoutId={editingTemplate?._id ? `title-${editingTemplate._id}` : undefined} className="text-xl font-bold text-gray-900">
                                        {editingTemplate ? 'Modifier le modèle' : 'Nouveau modèle'}
                                    </motion.h3>
                                    <button
                                        onClick={() => setShowTemplateModal(false)}
                                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                <form onSubmit={handleSaveTemplate} className="p-6 max-h-[calc(90vh-120px)] overflow-y-auto">
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-8">
                                        <div className="md:col-span-8 space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Nom du Modèle <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    required
                                                    value={formData.name}
                                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                                                    placeholder="ex: TDM Cérébral Standard"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Description
                                                </label>
                                                <input
                                                    type="text"
                                                    value={formData.description}
                                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                                                    placeholder="Brève description de ce modèle"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Mot déclencheur (Raccourci)
                                                </label>
                                                <input
                                                    type="text"
                                                    value={formData.triggerWord}
                                                    onChange={(e) => setFormData({ ...formData, triggerWord: e.target.value })}
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                                                    placeholder="ex: abdo (Tapez 'abdo' puis Entrée pour insérer)"
                                                />
                                            </div>
                                        </div>

                                        <div className="md:col-span-4 space-y-4 bg-gray-50 p-4 rounded-xl">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Modalité
                                                </label>
                                                <select
                                                    value={formData.modality}
                                                    onChange={(e) => setFormData({ ...formData, modality: e.target.value })}
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                                                >
                                                    <option value="">Sélectionner...</option>
                                                    {modalityOptions.map(mod => (
                                                        <option key={mod} value={mod}>{mod}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <label className="flex items-start space-x-3 p-2 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.isDefault}
                                                    onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                                                    className="mt-1 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                                                />
                                                <span className="text-sm text-gray-600">
                                                    Définir comme modèle par défaut pour cette modalité
                                                </span>
                                            </label>

                                            {/* Shared With Section */}
                                            <div className="pt-4 border-t border-gray-200">
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Partager avec
                                                </label>
                                                <div className="border border-gray-300 rounded-lg p-2 max-h-40 overflow-y-auto bg-white">
                                                    {radiologists.length === 0 ? (
                                                        <p className="text-xs text-gray-500 italic p-1">Aucun radiologue disponible</p>
                                                    ) : radiologists.filter(r => r._id !== user?._id).length > 0 ? (
                                                        radiologists.filter(r => r._id !== user?._id).map((rad) => (
                                                            <label key={rad._id} className="flex items-center space-x-2 p-1.5 hover:bg-gray-50 rounded cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={formData.sharedWith?.includes(rad._id)}
                                                                    onChange={(e) => {
                                                                        const currentShared = formData.sharedWith || [];
                                                                        if (e.target.checked) {
                                                                            setFormData({ ...formData, sharedWith: [...currentShared, rad._id] });
                                                                        } else {
                                                                            setFormData({ ...formData, sharedWith: currentShared.filter(id => id !== rad._id) });
                                                                        }
                                                                    }}
                                                                    className="rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                                                                />
                                                                <span className="text-sm text-gray-700 truncate">{rad.fullName || rad.email}</span>
                                                            </label>
                                                        ))
                                                    ) : (
                                                        <p className="text-xs text-gray-500 italic p-1">Vous êtes le seul radiologue</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-700">
                                            Contenu du Modèle
                                        </label>
                                        <div className=" rounded-xl overflow-hidden">
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
                                    </div>

                                    <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-gray-100">
                                        <button
                                            type="button"
                                            onClick={() => setShowTemplateModal(false)}
                                            className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                                        >
                                            Annuler
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm hover:shadow transition-all"
                                        >
                                            {editingTemplate ? 'Mettre à jour' : 'Créer le modèle'}
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Password Change Modal */}
                {showPasswordModal && (
                    <div
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                        onClick={() => {
                            setShowPasswordModal(false);
                            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                        }}
                    >
                        <div
                            className="bg-white rounded-2xl shadow-2xl max-w-md w-full transform transition-all"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                                <h3 className="text-xl font-bold text-gray-900">Changer le mot de passe</h3>
                                <button
                                    onClick={() => {
                                        setShowPasswordModal(false);
                                        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                                    }}
                                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleChangePassword} className="p-6 space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Mot de passe actuel
                                    </label>
                                    <input
                                        type="password"
                                        required
                                        value={passwordData.currentPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Nouveau mot de passe
                                    </label>
                                    <input
                                        type="password"
                                        required
                                        minLength={6}
                                        value={passwordData.newPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                                        placeholder="Min. 6 caractères"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Confirmer le mot de passe
                                    </label>
                                    <input
                                        type="password"
                                        required
                                        value={passwordData.confirmPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                                    />
                                </div>

                                <div className="flex justify-end space-x-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowPasswordModal(false);
                                            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                                        }}
                                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm hover:shadow transition-all"
                                    >
                                        Mettre à jour
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

