'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { usersAPI, clinicsAPI } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiPlus, FiEdit2, FiTrash2, FiUserCheck, FiUserX, 
  FiSearch, FiMail, FiShield, FiX, FiCheck, FiEye, FiEyeOff
} from 'react-icons/fi';
import { MdBusiness } from 'react-icons/md';

export default function UsersPage() {
  const { user } = useAuth();
  
  // Data State
  const [users, setUsers] = useState([]);
  const [clinics, setClinics] = useState([]);
  
  // UI State
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'RADIOLOGIST',
    allowedClinics: []
  });

  const [searchTerm, setSearchTerm] = useState('');

  // Initial Data Load
  useEffect(() => {
    if (user?.role === 'ADMIN') {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, clinicsRes] = await Promise.all([
        usersAPI.getAll(),
        clinicsAPI.getAll()
      ]);
      setUsers(usersRes.data);
      setClinics(clinicsRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      fullName: '',
      role: 'RADIOLOGIST',
      allowedClinics: []
    });
    setEditingUser(null);
    setShowPassword(false);
  };

  const openEditModal = (userToEdit) => {
    setEditingUser(userToEdit);
    setFormData({
      email: userToEdit.email,
      password: '',
      fullName: userToEdit.fullName,
      role: userToEdit.role,
      allowedClinics: userToEdit.allowedClinics?.map(c => typeof c === 'string' ? c : c._id) || []
    });
    setShowModal(true);
  };

  const handleClinicToggle = (clinicId) => {
    setFormData(prev => {
      const current = prev.allowedClinics || [];
      if (current.includes(clinicId)) {
        return { ...prev, allowedClinics: current.filter(id => id !== clinicId) };
      } else {
        return { ...prev, allowedClinics: [...current, clinicId] };
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData };
      
      if (editingUser && !payload.password) {
        delete payload.password;
      }

      if (editingUser) {
        await usersAPI.update(editingUser._id, payload);
        toast.success('Utilisateur mis à jour avec succès');
      } else {
        await usersAPI.create(payload);
        toast.success('Utilisateur créé avec succès');
      }
      
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Save error:', error);
      toast.error(error.response?.data?.error || "Erreur lors de l'enregistrement");
    }
  };

  const handleToggleActive = async (userId, isActive) => {
    try {
      await usersAPI.update(userId, { isActive: !isActive });
      toast.success(isActive ? 'Utilisateur désactivé' : 'Utilisateur activé');
      fetchData();
    } catch (error) {
      toast.error("Erreur lors du changement de statut");
    }
  };

  const handleDelete = async (userId) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur définitivement ?')) return;
    try {
      await usersAPI.delete(userId);
      toast.success('Utilisateur supprimé');
      setUsers(users.filter(u => u._id !== userId));
    } catch (error) {
      toast.error("Erreur lors de la suppression");
    }
  };

  const filteredUsers = users.filter(u =>
    u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleBadge = (role) => {
    const styles = {
      ADMIN: 'bg-purple-100 text-purple-700 border-purple-200',
      RADIOLOGIST: 'bg-blue-100 text-blue-700 border-blue-200',
      REFERRING_PHYSICIAN: 'bg-green-100 text-green-700 border-green-200',
      VIEWER: 'bg-gray-100 text-gray-700 border-gray-200'
    };
    const labels = {
      ADMIN: 'Administrateur',
      RADIOLOGIST: 'Radiologue',
      REFERRING_PHYSICIAN: 'Médecin Réf.',
      VIEWER: 'Visualiseur'
    };
    return (
      <span className={`px-2.5 py-1 inline-flex text-xs font-semibold rounded-full border ${styles[role] || styles.VIEWER}`}>
        {labels[role] || role}
      </span>
    );
  };

  if (user?.role !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-red-500 font-medium">Accès réservé aux administrateurs.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FiUserCheck className="text-blue-600" size={28} />
              Gestion des Utilisateurs
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Gérez les comptes, les rôles et l&apos;accès aux cliniques.
            </p>
          </div>
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-all transform hover:scale-105"
          >
            <FiPlus className="mr-2" size={18} />
            Nouvel Utilisateur
          </button>
        </div>

        {/* Table Container */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          
          {/* Search Bar */}
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Rechercher par nom ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="text-sm text-gray-500 self-center">
              {filteredUsers.length} utilisateur(s) trouvé(s)
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Utilisateur</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Rôle</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Accès Cliniques</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Statut</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-blue-600"></div>
                      <p className="mt-2 text-sm text-gray-500">Chargement...</p>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                      Aucun utilisateur trouvé.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u._id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 flex-shrink-0 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-sm">
                            {u.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{u.fullName}</div>
                            <div className="text-sm text-gray-500 flex items-center gap-1">
                               <FiMail size={12}/> {u.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getRoleBadge(u.role)}
                      </td>
                      <td className="px-6 py-4">
                        {u.role === 'ADMIN' ? (
                           <span className="text-xs text-gray-400 italic">Accès total</span>
                        ) : u.allowedClinics?.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                             <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                <MdBusiness size={12} className="mr-1"/>
                                {u.allowedClinics.length} clinique(s)
                             </span>
                          </div>
                        ) : (
                          <span className="text-xs text-red-500 font-medium">Aucun accès</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button 
                          onClick={() => handleToggleActive(u._id, u.isActive)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                            u.isActive 
                              ? 'bg-green-50 text-green-700 hover:bg-green-100 cursor-pointer border border-green-200' 
                              : 'bg-red-50 text-red-700 hover:bg-red-100 cursor-pointer border border-red-200'
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${u.isActive ? 'bg-green-500' : 'bg-red-500'}`}></span>
                          {u.isActive ? 'Actif' : 'Inactif'}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openEditModal(u)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Modifier"
                          >
                            <FiEdit2 size={18} />
                          </button>
                          {u._id !== user._id && (
                            <button
                              onClick={() => handleDelete(u._id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Supprimer"
                            >
                              <FiTrash2 size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
            >
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {editingUser ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
                </h3>
                <p className="text-sm text-gray-500">
                  {editingUser ? 'Mettez à jour les informations et les accès.' : 'Créez un compte et assignez des cliniques.'}
                </p>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-500 hover:bg-gray-100 p-2 rounded-full transition-colors"
              >
                <FiX size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto">
              <form id="userForm" onSubmit={handleSubmit} className="space-y-6">
                
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet</label>
                    <input
                      type="text"
                      required
                      value={formData.fullName}
                      onChange={e => setFormData({...formData, fullName: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                      placeholder="ex: Dr. Jean Dupont"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rôle</label>
                    <select
                      value={formData.role}
                      onChange={e => setFormData({...formData, role: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="RADIOLOGIST">Radiologue</option>
                      <option value="REFERRING_PHYSICIAN">Médecin Référent</option>
                      <option value="VIEWER">Visualiseur</option>
                      <option value="ADMIN">Administrateur</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {editingUser ? 'Nouveau mot de passe (optionnel)' : 'Mot de passe'}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        required={!editingUser}
                        minLength={6}
                        value={formData.password}
                        onChange={e => setFormData({...formData, password: e.target.value})}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder={editingUser ? "Laisser vide pour conserver" : "Min. 6 caractères"}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Clinic Access */}
                {formData.role !== 'ADMIN' && (
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center gap-2 mb-3">
                      <MdBusiness size={18} className="text-blue-600" />
                      <h4 className="font-semibold text-gray-900">Accès aux Cliniques</h4>
                    </div>
                    
                    {clinics.length === 0 ? (
                      <p className="text-sm text-gray-500 italic">Aucune clinique disponible.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-2">
                        {clinics.map(clinic => {
                          const isSelected = formData.allowedClinics.includes(clinic._id);
                          return (
                            <div 
                              key={clinic._id}
                              onClick={() => handleClinicToggle(clinic._id)}
                              className={`cursor-pointer flex items-center p-3 rounded-lg border transition-all ${
                                isSelected 
                                  ? 'bg-blue-50 border-blue-200 shadow-sm' 
                                  : 'bg-white border-gray-200 hover:border-blue-300'
                              }`}
                            >
                              <div className={`w-5 h-5 rounded border flex items-center justify-center mr-3 transition-colors ${
                                isSelected ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'
                              }`}>
                                {isSelected && <FiCheck size={12} className="text-white" />}
                              </div>
                              <span className={`text-sm ${isSelected ? 'font-medium text-blue-900' : 'text-gray-700'}`}>
                                {clinic.name}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      Sélectionnez les cliniques que cet utilisateur est autorisé à voir.
                    </p>
                  </div>
                )}
                
                {/* Admin Badge */}
                {formData.role === 'ADMIN' && (
                  <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 flex items-start gap-3">
                    <FiShield className="text-purple-600 mt-0.5" size={20} />
                    <div>
                      <p className="text-sm font-medium text-purple-900">Privilèges Administrateur</p>
                      <p className="text-xs text-purple-700 mt-1">
                        Les administrateurs ont automatiquement accès à <strong>toutes les cliniques</strong> et tous les paramètres.
                      </p>
                    </div>
                  </div>
                )}

                {/* Account Status Toggle */}
                {editingUser && (
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {editingUser.isActive ? (
                          <FiUserCheck className="text-green-600" size={20} />
                        ) : (
                          <FiUserX className="text-red-600" size={20} />
                        )}
                        <div>
                          <h4 className="font-semibold text-gray-900">Statut du compte</h4>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {editingUser.isActive 
                              ? "Le compte est actuellement actif et peut se connecter" 
                              : "Le compte est désactivé et ne peut pas se connecter"}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(editingUser._id, editingUser.isActive)}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                          editingUser.isActive
                            ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                            : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                        }`}
                      >
                        {editingUser.isActive ? 'Désactiver' : 'Activer'}
                      </button>
                    </div>
                  </div>
                )}

              </form>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                form="userForm"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors flex items-center gap-2"
              >
                {editingUser ? <FiCheck size={16}/> : <FiPlus size={16}/>}
                {editingUser ? 'Sauvegarder les modifications' : 'Créer l\'utilisateur'}
              </button>
            </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
