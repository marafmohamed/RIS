'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { reportsAPI, usersAPI } from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { FiEye, FiFilter, FiUsers, FiFileText, FiCheckCircle, FiEdit3 } from 'react-icons/fi';
import Link from 'next/link';

export default function ReportsPage() {
  const router = useRouter();
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    draft: 0,
    final: 0,
    byUser: []
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [selectedUser, setSelectedUser] = useState('all');
  const [currentUser, setCurrentUser] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'byUser'
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [userTablePage, setUserTablePage] = useState(1);
  const [userTableItemsPerPage] = useState(10);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      setCurrentUser(JSON.parse(userStr));
    }
    fetchData();
  }, [filter, selectedUser]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = filter !== 'ALL' ? { status: filter } : {};
      const [reportsRes, statsRes] = await Promise.all([
        reportsAPI.getAll(params),
        reportsAPI.getStats()
      ]);

      setReports(reportsRes.data);
      setStats(statsRes.data);

      // Fetch users only if admin
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user.role === 'ADMIN') {
          const usersRes = await usersAPI.getAll();
          setUsers(usersRes.data.users || usersRes.data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch reports:', error);
      toast.error('Échec du chargement des rapports');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredReports = () => {
    let filtered = [...reports];

    if (selectedUser !== 'all') {
      filtered = filtered.filter(report => report.authorId?._id === selectedUser);
    }

    return filtered;
  };

  const getUserStats = (userId) => {
    const userReports = reports.filter(r => r.authorId?._id === userId);
    const draft = userReports.filter(r => r.status === 'DRAFT').length;
    const final = userReports.filter(r => r.status === 'FINAL').length;

    return { total: userReports.length, draft, final };
  };

  const getStatusBadge = (status) => {
    return status === 'FINAL'
      ? 'bg-green-100 text-green-800'
      : 'bg-yellow-100 text-yellow-800';
  };

  const isAdmin = currentUser?.role === 'ADMIN';
  const isViewer = currentUser?.role === 'VIEWER';
  const filteredReports = getFilteredReports();

  // Pagination calculations for reports
  const indexOfLastReport = currentPage * itemsPerPage;
  const indexOfFirstReport = indexOfLastReport - itemsPerPage;
  const currentReports = filteredReports.slice(indexOfFirstReport, indexOfLastReport);
  const totalPages = Math.ceil(filteredReports.length / itemsPerPage);

  // Pagination calculations for user table
  const radiologists = users.filter(u => u.role === 'RADIOLOGIST' || u.role === 'ADMIN');
  const indexOfLastUser = userTablePage * userTableItemsPerPage;
  const indexOfFirstUser = indexOfLastUser - userTableItemsPerPage;
  const currentRadiologists = radiologists.slice(indexOfFirstUser, indexOfLastUser);
  const userTableTotalPages = Math.ceil(radiologists.length / userTableItemsPerPage);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUserTablePageChange = (pageNumber) => {
    setUserTablePage(pageNumber);
  };

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, selectedUser]);

  useEffect(() => {
    setUserTablePage(1);
  }, [viewMode]);

  return (
    <>
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {isAdmin ? 'Gestion des rapports' : isViewer ? 'Rapports' : 'Mes rapports'}
          </h1>
          <p className="mt-2 text-gray-600">
            {isAdmin ? 'Voir tous les rapports de radiologie et suivre la productivité' :
              isViewer ? 'Consulter les rapports de radiologie finalisés' :
                'Voir et gérer vos rapports de radiologie'}
          </p>
        </div>

        {/* Admin Statistics */}
        {isAdmin && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="card bg-blue-50 border border-blue-200">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-blue-100 mr-4">
                    <FiFileText className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total des rapports</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                  </div>
                </div>
              </div>

              <div className="card bg-yellow-50 border border-yellow-200">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-yellow-100 mr-4">
                    <FiEdit3 className="h-6 w-6 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Rapports brouillons</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.draft}</p>
                  </div>
                </div>
              </div>

              <div className="card bg-green-50 border border-green-200">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-green-100 mr-4">
                    <FiCheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Rapports finaux</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.final}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* View Mode Toggle */}
            <div className="card mb-6">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${viewMode === 'list'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  <FiFileText className="inline mr-2" />
                  Liste des rapports
                </button>
                <button
                  onClick={() => setViewMode('byUser')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${viewMode === 'byUser'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  <FiUsers className="inline mr-2" />
                  Par radiologue
                </button>
              </div>
            </div>

            {/* User Statistics Table */}
            {viewMode === 'byUser' && (
              <div className="card mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center px-6 pt-6">
                  <FiUsers className="mr-2" />
                  Rapports par radiologue
                </h2>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Radiologue
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total des rapports
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Brouillon
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Final
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {currentRadiologists.map((user) => {
                        const userStats = getUserStats(user._id);
                        return (
                          <tr key={user._id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{user.fullName}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-500">{user.email}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-semibold text-gray-900">{userStats.total}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                {userStats.draft}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                {userStats.final}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <button
                                onClick={() => {
                                  setSelectedUser(user._id);
                                  setViewMode('list');
                                }}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                Voir les rapports
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* User Table Pagination */}
                {userTableTotalPages > 1 && (
                  <div className="px-6 py-4 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-700">
                        Affichage de {indexOfFirstUser + 1} à {Math.min(indexOfLastUser, radiologists.length)} sur {radiologists.length} radiologues
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleUserTablePageChange(userTablePage - 1)}
                          disabled={userTablePage === 1}
                          className="px-3 py-1 rounded-md border border-gray-300 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Précédent
                        </button>
                        {Array.from({ length: userTableTotalPages }, (_, i) => i + 1).map((page) => (
                          <button
                            key={page}
                            onClick={() => handleUserTablePageChange(page)}
                            className={`px-3 py-1 rounded-md text-sm font-medium ${userTablePage === page
                              ? 'bg-blue-600 text-white'
                              : 'border border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                              }`}
                          >
                            {page}
                          </button>
                        ))}
                        <button
                          onClick={() => handleUserTablePageChange(userTablePage + 1)}
                          disabled={userTablePage === userTableTotalPages}
                          className="px-3 py-1 rounded-md border border-gray-300 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Suivant
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Filters */}
        {viewMode === 'list' && (
          <div className="card mb-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center space-x-2">
                <FiFilter className="text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Filtrer par statut :</span>
                <div className="flex space-x-2">
                  {['ALL', 'DRAFT', 'FINAL'].map((status) => (
                    <button
                      key={status}
                      onClick={() => setFilter(status)}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === status
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              {isAdmin && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-700">Radiologue :</span>
                  <select
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                    className="input max-w-xs"
                  >
                    <option value="all">Tous les radiologues</option>
                    {users.filter(u => u.role === 'RADIOLOGIST' || u.role === 'ADMIN').map((user) => (
                      <option key={user._id} value={user._id}>
                        {user.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {(selectedUser !== 'all') && (
                <button
                  onClick={() => setSelectedUser('all')}
                  className="btn btn-secondary"
                >
                  Effacer le filtre
                </button>
              )}
            </div>
          </div>
        )}

        {/* Reports Table */}
        {viewMode === 'list' && (
          <div className="card overflow-hidden">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 px-6 pt-6">
              Rapports ({filteredReports.length})
            </h2>

            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Chargement des rapports...</p>
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">Aucun rapport trouvé</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Patient
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date de l&apos;étude
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Modalité
                      </th>
                      {isAdmin && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Auteur
                        </th>
                      )}
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Statut
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Mis à jour
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {currentReports.map((report) => (
                      <tr key={report._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {report.patientName}
                          </div>
                          <div className="text-sm text-gray-500">{report.patientId}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">
                            {format(new Date(report.studyDate), 'MMM dd, yyyy')}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                            {report.modality}
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {report.authorId?.fullName || report.authorName || 'Unknown'}
                            </div>
                          </td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(report.status)}`}>
                            {report.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">
                            {format(new Date(report.updatedAt), 'MMM dd, yyyy HH:mm')}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <Link
                            href={`/reporting/${report.studyInstanceUid}`}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <FiEye className="inline mr-1" />
                            Voir
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Reports Pagination */}
            {!loading && filteredReports.length > 0 && totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Affichage de {indexOfFirstReport + 1} à {Math.min(indexOfLastReport, filteredReports.length)} sur {filteredReports.length} rapports
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-3 py-1 rounded-md border border-gray-300 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Précédent
                    </button>
                    {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
                      // Show first 3, last 3, and current page context
                      const page = i + 1;
                      if (
                        page <= 3 ||
                        page > totalPages - 3 ||
                        (page >= currentPage - 1 && page <= currentPage + 1)
                      ) {
                        return (
                          <button
                            key={page}
                            onClick={() => handlePageChange(page)}
                            className={`px-3 py-1 rounded-md text-sm font-medium ${currentPage === page
                              ? 'bg-blue-600 text-white'
                              : 'border border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                              }`}
                          >
                            {page}
                          </button>
                        );
                      } else if (page === 4 || page === totalPages - 3) {
                        return <span key={page} className="px-2 text-gray-500">...</span>;
                      }
                      return null;
                    })}
                    {totalPages > 10 && Array.from({ length: totalPages - 10 }, (_, i) => {
                      const page = i + 11;
                      if (
                        page <= 3 ||
                        page > totalPages - 3 ||
                        (page >= currentPage - 1 && page <= currentPage + 1)
                      ) {
                        return (
                          <button
                            key={page}
                            onClick={() => handlePageChange(page)}
                            className={`px-3 py-1 rounded-md text-sm font-medium ${currentPage === page
                              ? 'bg-blue-600 text-white'
                              : 'border border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                              }`}
                          >
                            {page}
                          </button>
                        );
                      } else if (page === 4 || page === totalPages - 3) {
                        return <span key={page} className="px-2 text-gray-500">...</span>;
                      }
                      return null;
                    })}
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 rounded-md border border-gray-300 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Suivant
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
