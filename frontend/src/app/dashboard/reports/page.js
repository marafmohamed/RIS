'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { reportsAPI, usersAPI } from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  FiEye, FiFilter, FiUsers, FiFileText, FiCheckCircle, FiEdit3, FiLayers, FiStar, FiMessageSquare
} from 'react-icons/fi';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import ValidationHistory from '@/components/ValidationHistory';

export default function ReportsPage() {
  const router = useRouter();
  const { user } = useAuth(); // Use context for auth

  // Data
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({ total: 0, draft: 0, final: 0, byUser: [] });

  // UI State
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'stats'
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [radiologistFilter, setRadiologistFilter] = useState('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchData();
  }, [statusFilter, radiologistFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = statusFilter !== 'ALL' ? { status: statusFilter } : {};

      const promises = [reportsAPI.getAll(params), reportsAPI.getStats()];

      if (user?.role === 'ADMIN') {
        promises.push(usersAPI.getAll());
      }

      const results = await Promise.all(promises);
      const reportsRes = results[0];
      const statsRes = results[1];

      setReports(reportsRes.data);
      setStats(statsRes.data);

      if (user?.role === 'ADMIN' && results[2]) {
        const usersRes = results[2];
        setUsers(usersRes.data.users || usersRes.data);
      }

    } catch (error) {
      console.error('Failed to fetch reports:', error);
      toast.error('Échec du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredReports = () => {
    let filtered = [...reports];
    if (radiologistFilter !== 'all') {
      filtered = filtered.filter(report => report.authorId?._id === radiologistFilter);
    }
    return filtered;
  };

  const getUserStats = (userId) => {
    // This calculation is done client side based on loaded reports to be quick
    // Ideally stats endpoint provides this
    const userReports = reports.filter(r => r.authorId?._id === userId);
    const draft = userReports.filter(r => r.status === 'DRAFT').length;
    const final = userReports.filter(r => r.status === 'FINAL').length;
    return { total: userReports.length, draft, final };
  };

  const filteredReports = getFilteredReports();
  const isAdmin = user?.role === 'ADMIN';

  // Pagination Logic
  const indexOfLastReport = currentPage * itemsPerPage;
  const indexOfFirstReport = indexOfLastReport - itemsPerPage;
  const currentReports = filteredReports.slice(indexOfFirstReport, indexOfLastReport);
  const totalPages = Math.ceil(filteredReports.length / itemsPerPage);

  const handlePageChange = (pageNum) => setCurrentPage(pageNum);

  const StatusBadge = ({ status }) => {
    const styles = {
      FINAL: 'bg-green-100 text-green-800',
      DRAFT: 'bg-yellow-100 text-yellow-800',
      ASSIGNED: 'bg-blue-100 text-blue-800'
    };
    const style = styles[status] || 'bg-gray-100 text-gray-800';
    return (
      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${style}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="md:flex md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              {isAdmin ? 'Administration des Rapports' : 'Mes Rapports'}
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              {isAdmin
                ? 'Gérez tous les rapports et suivez la productivité des radiologues.'
                : 'Consultez et modifiez vos comptes rendus.'}
            </p>
          </div>

          {/* Global Stats (Admin Only) */}
          {isAdmin && (
            <div className="mt-4 md:mt-0 flex gap-4">
              <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 flex flex-col items-center min-w-[100px]">
                <span className="text-xs text-gray-500 uppercase">Total</span>
                <span className="text-xl font-bold text-gray-900">{stats.total}</span>
              </div>
              <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 flex flex-col items-center min-w-[100px]">
                <span className="text-xs text-yellow-600 uppercase">Brouillons</span>
                <span className="text-xl font-bold text-yellow-600">{stats.draft}</span>
              </div>
              <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 flex flex-col items-center min-w-[100px]">
                <span className="text-xs text-green-600 uppercase">Finalisés</span>
                <span className="text-xl font-bold text-green-600">{stats.final}</span>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        {isAdmin && (
          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('list')}
                className={`
                  ${activeTab === 'list' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                  whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center
                `}
              >
                <FiFileText className="mr-2" />
                Liste des rapports
              </button>
              <button
                onClick={() => setActiveTab('stats')}
                className={`
                  ${activeTab === 'stats' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                  whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center
                `}
              >
                <FiUsers className="mr-2" />
                Productivité par radiologue
              </button>
            </nav>
          </div>
        )}

        {/* View 1: List View */}
        {activeTab === 'list' && (
          <>
            {/* Filters Bar */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6 flex flex-wrap gap-4 items-center">
              <div className="flex items-center">
                <FiFilter className="text-gray-400 mr-2" />
                <span className="text-sm font-medium text-gray-700 mr-2">Statut:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="block w-full rounded-md border-gray-300 py-1.5 text-base text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm sm:leading-6 border px-2"
                >
                  <option value="ALL">Tous les statuts</option>
                  <option value="DRAFT">Brouillons</option>
                  <option value="FINAL">Finalisés</option>
                </select>
              </div>

              {isAdmin && (
                <div className="flex items-center">
                  <FiUsers className="text-gray-400 mr-2" />
                  <span className="text-sm font-medium text-gray-700 mr-2">Auteur:</span>
                  <select
                    value={radiologistFilter}
                    onChange={(e) => setRadiologistFilter(e.target.value)}
                    className="block w-full rounded-md border-gray-300 py-1.5 text-base text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm sm:leading-6 border px-2"
                  >
                    <option value="all">Tous les radiologues</option>
                    {users.filter(u => u.role === 'RADIOLOGIST' || u.role === 'ADMIN').map((u) => (
                      <option key={u._id} value={u._id}>{u.fullName}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Table */}
            <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
                </div>
              ) : filteredReports.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  Aucun rapport ne correspond aux filtres.
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Examen</th>
                          {isAdmin && (
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Auteur</th>
                          )}
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Validations</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Note</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dernière Modif.</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {currentReports.map((report) => (
                          <tr key={report._id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{report.patientName}</div>
                              <div className="text-xs text-gray-500">{report.patientId}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-100 mb-1">
                                {report.modality || 'NA'}
                              </span>
                              <div className="text-xs text-gray-500">
                                {format(new Date(report.studyDate), 'dd/MM/yyyy')}
                              </div>
                            </td>
                            {isAdmin && (
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {report.authorId?.fullName || report.authorName || 'Inconnu'}
                              </td>
                            )}
                            <td className="px-6 py-4 whitespace-nowrap">
                              <StatusBadge status={report.status} />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              {report.status === 'FINAL' && report.validationCount > 0 ? (
                                <button
                                  onClick={() => {
                                    setSelectedReport(report);
                                    setShowValidationModal(true);
                                  }}
                                  className="inline-flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium bg-green-100 text-green-800 hover:bg-green-200 transition-colors"
                                >
                                  <FiCheckCircle className="mr-1 h-3 w-3" />
                                  {report.validationCount}
                                </button>
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              {report.status === 'FINAL' && report.averageRating > 0 ? (
                                <button
                                  onClick={() => {
                                    setSelectedReport(report);
                                    setShowValidationModal(true);
                                  }}
                                  className="inline-flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium bg-yellow-100 text-yellow-800 hover:bg-yellow-200 transition-colors"
                                >
                                  <FiStar className="mr-1 h-3 w-3" />
                                  {report.averageRating.toFixed(1)}
                                </button>
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {format(new Date(report.updatedAt), 'dd MMM HH:mm')}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                              <Link
                                href={`/reporting/${report.studyInstanceUid}`}
                                className="text-blue-600 hover:text-blue-900 inline-flex items-center gap-1"
                              >
                                {report.status === 'FINAL' ? <FiEye /> : <FiEdit3 />}
                                <span>{report.status === 'FINAL' ? 'Voir' : 'Éditer'}</span>
                              </Link>
                              {report.status === 'FINAL' && (report.validationCount > 0 || report.averageRating > 0) && (
                                <button
                                  onClick={() => {
                                    setSelectedReport(report);
                                    setShowValidationModal(true);
                                  }}
                                  className="text-gray-600 hover:text-gray-900 inline-flex items-center gap-1"
                                  title="Voir validations"
                                >
                                  <FiMessageSquare />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                      <div className="flex-1 flex justify-between sm:hidden">
                        <button
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                        >
                          Préc.
                        </button>
                        <button
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage === totalPages}
                          className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                        >
                          Suiv.
                        </button>
                      </div>
                      <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm text-gray-700">
                            Page <span className="font-medium">{currentPage}</span> sur <span className="font-medium">{totalPages}</span>
                          </p>
                        </div>
                        <div>
                          <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                            <button
                              onClick={() => handlePageChange(currentPage - 1)}
                              disabled={currentPage === 1}
                              className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                            >
                              Précédent
                            </button>
                            <button
                              onClick={() => handlePageChange(currentPage + 1)}
                              disabled={currentPage === totalPages}
                              className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                            >
                              Suivant
                            </button>
                          </nav>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {/* View 2: Radiologist Stats (Admin Only) */}
        {activeTab === 'stats' && isAdmin && (
          <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Radiologue</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Brouillons</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Finalisés</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users
                  .filter(u => u.role === 'RADIOLOGIST' || u.role === 'ADMIN')
                  .map(user => {
                    const s = getUserStats(user._id);
                    return (
                      <tr key={user._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {user.fullName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {user.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-bold text-gray-900">
                          {s.total}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                            {s.draft}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            {s.final}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => {
                              setRadiologistFilter(user._id);
                              setActiveTab('list');
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
        )}
      </div>

      {/* Validation History Modal */}
      {showValidationModal && selectedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Validations et Notes</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Patient: <strong>{selectedReport.patientName}</strong> ({selectedReport.patientId})
                </p>
              </div>
              <button
                onClick={() => {
                  setShowValidationModal(false);
                  setSelectedReport(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <ValidationHistory report={selectedReport} />
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => {
                  setShowValidationModal(false);
                  setSelectedReport(null);
                }}
                className="btn btn-secondary"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}