'use client';

import { useState, useEffect } from 'react';
import { clinicsAPI } from '@/lib/api';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Building, Save, X } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { Editor } from '@tinymce/tinymce-react';

export default function ClinicsPage() {
    const [clinics, setClinics] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingClinic, setEditingClinic] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        nameArabic: '',
        address: '',
        phone: '',
        email: '',
        headerContent: '',
        footerContent: '',
        orthancUrl: '',
        orthancUsername: '',
        orthancPassword: '',
        isDefault: false
    });

    useEffect(() => {
        loadClinics();
    }, []);

    const loadClinics = async () => {
        try {
            setLoading(true);
            const response = await clinicsAPI.getAll();
            setClinics(response.data);
        } catch (error) {
            console.error('Failed to load clinics:', error);
            toast.error('Erreur lors du chargement des cliniques');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (clinic) => {
        setEditingClinic(clinic);
        setFormData({
            name: clinic.name,
            nameArabic: clinic.nameArabic || '',
            address: clinic.address || '',
            phone: clinic.phone || '',
            email: clinic.email || '',
            headerContent: clinic.headerContent || '',
            footerContent: clinic.footerContent || '',
            orthancUrl: clinic.orthancUrl || '',
            orthancUsername: clinic.orthancUsername || '',
            orthancPassword: '', // Don't show password
            isDefault: clinic.isDefault
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cette clinique ?')) return;

        try {
            await clinicsAPI.delete(id);
            toast.success('Clinique supprimée avec succès');
            loadClinics();
        } catch (error) {
            console.error('Failed to delete clinic:', error);
            toast.error('Erreur lors de la suppression');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingClinic) {
                await clinicsAPI.update(editingClinic._id, formData);
                toast.success('Clinique mise à jour avec succès');
            } else {
                await clinicsAPI.create(formData);
                toast.success('Clinique créée avec succès');
            }
            setShowModal(false);
            resetForm();
            loadClinics();
        } catch (error) {
            console.error('Failed to save clinic:', error);
            toast.error('Erreur lors de l\'enregistrement');
        }
    };

    const resetForm = () => {
        setEditingClinic(null);
        setFormData({
            name: '',
            nameArabic: '',
            address: '',
            phone: '',
            email: '',
            headerContent: '',
            footerContent: '',
            orthancUrl: '',
            orthancUsername: '',
            orthancPassword: '',
            isDefault: false
        });
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />
            <div className="p-6 max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Gestion des Cliniques</h1>
                        <p className="text-gray-600 mt-2">
                            Gérez les cliniques et leurs configurations Orthanc. Les en-têtes et pieds de page sont utilisés pour les exports PDF et Word.
                        </p>
                    </div>
                    <button
                        onClick={() => { resetForm(); setShowModal(true); }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                    >
                        <Plus size={20} />
                        Nouvelle Clinique
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {clinics.map((clinic) => (
                            <div key={clinic._id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                                <div className="h-32 bg-gray-100 relative">
                                    {clinic.headerImage ? (
                                        <img src={clinic.headerImage} alt="Header" className="w-full h-full object-contain p-2" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                                            <span className="text-sm">Pas d'en-tête</span>
                                        </div>
                                    )}
                                    {clinic.isDefault && (
                                        <span className="absolute top-2 right-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded-full">
                                            Par défaut
                                        </span>
                                    )}
                                </div>

                                <div className="p-4">
                                    <div className="flex items-start gap-3 mb-3">
                                        <Building className="text-blue-600 flex-shrink-0 mt-1" size={20} />
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-gray-900 truncate">{clinic.name}</h3>
                                            {clinic.address && (
                                                <p className="text-sm text-gray-500 truncate">{clinic.address}</p>
                                            )}
                                        </div>
                                    </div>

                                    {clinic.orthancUrl && (
                                        <div className="mb-3 p-2 bg-blue-50 rounded text-xs">
                                            <p className="text-blue-700 font-medium">PACS Configuré</p>
                                            <p className="text-blue-600 truncate">{clinic.orthancUrl}</p>
                                        </div>
                                    )}

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleEdit(clinic)}
                                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                                        >
                                            <Edit size={16} />
                                            Modifier
                                        </button>
                                        <button
                                            onClick={() => handleDelete(clinic._id)}
                                            className="flex items-center justify-center p-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                                            title="Supprimer"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                {clinic.footerImage && (
                                    <div className="h-20 bg-gray-50 border-t border-gray-100">
                                        <img src={clinic.footerImage} alt="Footer" className="w-full h-full object-contain p-2" />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Modal */}
                {showModal && (
                    <div
                        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                        onClick={(e) => {
                            if (e.target === e.currentTarget) setShowModal(false);
                        }}
                    >
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                            <div className="flex justify-between items-center p-6 border-b border-gray-100">
                                <h2 className="text-xl font-bold text-gray-900">
                                    {editingClinic ? 'Modifier la clinique' : 'Nouvelle clinique'}
                                </h2>
                                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                                    <X size={24} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-6 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Nom de la clinique *</label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="Ex: Cabinet d'Imagerie Médicale"
                                        />
                                    </div>

                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Nom en arabe</label>
                                        <input
                                            type="text"
                                            value={formData.nameArabic}
                                            onChange={(e) => setFormData({ ...formData, nameArabic: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="عيادة التصوير الطبي"
                                            dir="rtl"
                                        />
                                    </div>

                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
                                        <input
                                            type="text"
                                            value={formData.address}
                                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                                        <input
                                            type="text"
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>

                                    <div className="col-span-2 border-t border-gray-200 pt-4 mt-2">
                                        <h4 className="text-sm font-semibold text-gray-900 mb-3">Configuration PACS (Orthanc)</h4>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">URL du Serveur Orthanc</label>
                                                <input
                                                    type="url"
                                                    placeholder="http://localhost:8042"
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                    value={formData.orthancUrl || ''}
                                                    onChange={(e) => setFormData({ ...formData, orthancUrl: e.target.value })}
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom d'utilisateur</label>
                                                    <input
                                                        type="text"
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                        value={formData.orthancUsername || ''}
                                                        onChange={(e) => setFormData({ ...formData, orthancUsername: e.target.value })}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
                                                    <input
                                                        type="password"
                                                        placeholder={editingClinic ? "Laisser vide pour ne pas changer" : ""}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                        value={formData.orthancPassword || ''}
                                                        onChange={(e) => setFormData({ ...formData, orthancPassword: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-span-2 space-y-4 border-t border-gray-200 pt-4">
                                        <p className="text-sm text-gray-600">Les en-têtes et pieds de page suivants seront utilisés dans les exports PDF et Word (supportent texte et images)</p>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">En-tête du document</label>
                                            <div className="border border-gray-300 rounded-lg overflow-hidden">
                                                <Editor
                                                    apiKey="no-api-key"
                                                    value={formData.headerContent}
                                                    onEditorChange={(content) => setFormData({ ...formData, headerContent: content })}
                                                    init={{
                                                        height: 200,
                                                        menubar: false,
                                                        plugins: [
                                                            'advlist', 'autolink', 'lists', 'link', 'image', 'charmap',
                                                            'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
                                                            'insertdatetime', 'media', 'table', 'preview', 'help', 'wordcount'
                                                        ],
                                                        toolbar: 'undo redo | blocks | bold italic forecolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | image | removeformat | help',
                                                        content_style: 'body { font-family:Helvetica,Arial,sans-serif; font-size:14px }',
                                                        branding: false
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Pied de page du document</label>
                                            <div className="border border-gray-300 rounded-lg overflow-hidden">
                                                <Editor
                                                    apiKey="no-api-key"
                                                    value={formData.footerContent}
                                                    onEditorChange={(content) => setFormData({ ...formData, footerContent: content })}
                                                    init={{
                                                        height: 150,
                                                        menubar: false,
                                                        plugins: [
                                                            'advlist', 'autolink', 'lists', 'link', 'image', 'charmap',
                                                            'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
                                                            'insertdatetime', 'media', 'table', 'preview', 'help', 'wordcount'
                                                        ],
                                                        toolbar: 'undo redo | blocks | bold italic forecolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | image | removeformat | help',
                                                        content_style: 'body { font-family:Helvetica,Arial,sans-serif; font-size:14px }',
                                                        branding: false
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-span-2">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.isDefault}
                                                onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-sm text-gray-700">Définir comme clinique par défaut</span>
                                        </label>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                                    >
                                        <Save size={18} />
                                        Enregistrer
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
