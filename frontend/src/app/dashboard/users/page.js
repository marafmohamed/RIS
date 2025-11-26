'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { usersAPI } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import { FiPlus, FiEdit2, FiTrash2, FiUserCheck, FiUserX } from 'react-icons/fi';

export default function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'RADIOLOGIST'
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      fetchUsers();
    }
  }, [user]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await usersAPI.getAll();
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      toast.error('Échec du chargement des utilisateurs');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await usersAPI.update(editingUser._id, {
          fullName: formData.fullName,
          role: formData.role
        });
        toast.success('Utilisateur mis à jour avec succès');
      } else {
        await usersAPI.create(formData);
        toast.success('Utilisateur créé avec succès');
      }
      setShowModal(false);
      resetForm();
      fetchUsers();
    } catch (error) {
      console.error('Failed to save user:', error);
      toast.error(error.response?.data?.error || 'Échec de l\'enregistrement de l\'utilisateur');
    }
  };

  const handleToggleActive = async (userId, isActive) => {
    try {
      await usersAPI.update(userId, { isActive: !isActive });
      toast.success(`Utilisateur ${!isActive ? 'activé' : 'désactivé'}`);
      fetchUsers();
    } catch (error) {
      toast.error('Échec de la mise à jour du statut de l\'utilisateur');
    }
  };

  const handleDelete = async (userId) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur?')) return;

    try {
      await usersAPI.delete(userId);
      toast.success('Utilisateur supprimé avec succès');
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Échec de la suppression de l\'utilisateur');
    }
  };

  // Filter users based on search term
  const filteredUsers = users.filter(u =>
    u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination calculations
  const indexOfLastUser = currentPage * itemsPerPage;
  const indexOfFirstUser = indexOfLastUser - itemsPerPage;
  const currentUsers = filteredUsers.slice(indexOfFirstUser, indexOfLastUser);
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Reset to page 1 when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      fullName: '',
      role: 'RADIOLOGIST'
    });
    setEditingUser(null);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      password: '',
      fullName: user.fullName,
      role: user.role
    });
    setShowModal(true);
  };

  if (user?.role !== 'ADMIN') {
    return (
      <>
        <Navbar />
        <div className="flex items-center justify-center h-screen">
          <p className="text-red-600">Accès refusé. Administrateurs uniquement.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gestion des utilisateurs</h1>
            <p className="mt-2 text-gray-600">Gérez les utilisateurs du système et leurs rôles</p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="btn btn-primary"
          >
            <FiPlus className="inline mr-2" />
            Ajouter un utilisateur
          </button>
        </div>

        {/* Table des utilisateurs */}
        <div className="card overflow-hidden">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Chargement des utilisateurs...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">
                {searchTerm ? `Aucun utilisateur trouvé correspondant à "${searchTerm}"` : 'Aucun utilisateur trouvé'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nom
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Courriel
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rôle
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Statut
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentUsers.map((u) => (
                    <tr key={u._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{u.fullName}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{u.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' :
                            u.role === 'RADIOLOGIST' ? 'bg-blue-100 text-blue-800' :
                              u.role === 'REFERRING_PHYSICIAN' ? 'bg-green-100 text-green-800' :
                                'bg-gray-100 text-gray-800'
                          }`}>
                          {u.role === 'ADMIN' ? 'Administrateur' :
                            u.role === 'RADIOLOGIST' ? 'Radiologue' :
                              u.role === 'REFERRING_PHYSICIAN' ? 'Médecin référent' :
                                'Visualiseur'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${u.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                          {u.isActive ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-3">
                        <button
                          onClick={() => openEditModal(u)}
                          className="text-blue-600 hover:text-blue-900 transition-colors"
                        >
                          <FiEdit2 className="inline mr-1" />
                          Modifier
                        </button>
                        <button
                          onClick={() => handleToggleActive(u._id, u.isActive)}
                          className={`transition-colors ${u.isActive ? 'text-orange-600 hover:text-orange-900' : 'text-green-600 hover:text-green-900'}`}
                        >
                          {u.isActive ? <FiUserX className="inline mr-1" /> : <FiUserCheck className="inline mr-1" />}
                          {u.isActive ? 'Désactiver' : 'Activer'}
                        </button>
                        {u._id !== user._id && (
                          <button
                            onClick={() => handleDelete(u._id)}
                            className="text-red-600 hover:text-red-900 transition-colors"
                          >
                            <FiTrash2 className="inline mr-1" />
                            Supprimer
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {!loading && filteredUsers.length > 0 && (
          <div className="mt-6 flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 rounded-lg shadow-sm">
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Affichage de <span className="font-medium">{indexOfFirstUser + 1}</span> à <span className="font-medium">{Math.min(indexOfLastUser, filteredUsers.length)}</span> sur <span className="font-medium">{filteredUsers.length}</span> résultats
                </p>
              </div>
              <div>
                <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="sr-only">Précédent</span>
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                    </svg>
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      aria-current={currentPage === page ? 'page' : undefined}
                      className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${currentPage === page
                          ? 'z-10 bg-blue-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
                          : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0'
                        }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="sr-only">Suivant</span>
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                    </svg>
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 text-sm text-gray-600">
          {searchTerm ? `Trouvé ${filteredUsers.length} sur ${users.length} utilisateurs` : `Total des utilisateurs : ${users.length}`}
        </div>

        { /* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
              <h2 className="text-2xl font-bold mb-6">
                {editingUser ? 'Modifier l’utilisateur' : 'Créer un nouvel utilisateur'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input"
                    required
                    disabled={editingUser}
                  />
                </div>

                {!editingUser && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Mot de passe
                    </label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="input"
                      required={!editingUser}
                      minLength={6}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nom complet
                  </label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="input"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rôle
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="input"
                    required
                  >
                    <option value="RADIOLOGIST">Radiologue</option>
                    <option value="ADMIN">Administrateur</option>
                    <option value="VIEWER">Visualiseur</option>
                    <option value="REFERRING_PHYSICIAN">Médecin référent</option>
                  </select>
                </div>

                <div className="flex space-x-3 mt-6">
                  <button type="submit" className="btn btn-primary flex-1">
                    {editingUser ? 'Mettre à jour' : 'Créer'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      resetForm();
                    }}
                    className="btn btn-secondary flex-1"
                  >
                    Annuler
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
