'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { studiesAPI, clinicsAPI, reportsAPI, usersAPI } from '@/lib/api';
import { toast } from 'sonner';
import {
  Search, Filter, Download, UserPlus,
  FileCheck, FileClock, FileX, Inbox,
  ChevronRight, ChevronLeft, Building2, Activity, Calendar,
  FileText, Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/lib/AuthContext';
import { generatePDF } from '@/utils/pdfExport';
import { generateWordDocument } from '@/utils/wordExport';

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();

  // Data State
  const [studies, setStudies] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [radiologists, setRadiologists] = useState([]);

  // UI State
  const [loading, setLoading] = useState(true);
  const [isNavigating, setIsNavigating] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [showAssignModal, setShowAssignModal] = useState(false);

  // Selection State
  const [selectedStudy, setSelectedStudy] = useState(null);
  const [selectedRadiologist, setSelectedRadiologist] = useState('');

  // Filter State
  const [filters, setFilters] = useState({
    patientName: '',
    patientId: '',
    startDate: '',
    endDate: '',
    clinicId: '',
    modality: ''
  });

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Standard DICOM Modalities
  const modalities = [
    { code: 'CT', label: 'Scanner (CT)' },
    { code: 'MR', label: 'IRM (MR)' },
    { code: 'US', label: 'Échographie (US)' },
    { code: 'CR', label: 'Radio CR' },
    { code: 'DX', label: 'Radio DX' },
    { code: 'MG', label: 'Mammographie' },
    { code: 'XA', label: 'Angiographie' },
    { code: 'NM', label: 'Médecine Nucléaire' },
    { code: 'OT', label: 'Autre' },
  ];

  useEffect(() => {
    fetchClinics();
    if (user?.role === 'ADMIN') {
      fetchRadiologists();
    }
  }, [user]);

  useEffect(() => {
    if (clinics.length > 0 && !filters.clinicId) {
      const defaultClinic = clinics.find(c => c.isDefault) || clinics[0];
      if (defaultClinic) {
        setFilters(prev => ({ ...prev, clinicId: defaultClinic._id }));
      }
    } else if (clinics.length === 0) {
      // User has no clinic access - clear clinicId
      setFilters(prev => ({ ...prev, clinicId: '' }));
    }
  }, [clinics]);

  useEffect(() => {
    if (filters.clinicId) {
      fetchStudies();
    }
  }, [filters.clinicId, activeFilter, filters.modality]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, filters]);

  // NEW: Force restricted users to 'final' view only
  useEffect(() => {
    if (user && ['VIEWER', 'REFERRING_PHYSICIAN'].includes(user.role)) {
      setActiveFilter('final');
    }
  }, [user]);

  const fetchClinics = async () => {
    try {
      const response = await clinicsAPI.getAll();
      setClinics(response.data || []);
    } catch (error) {
      console.error('Failed to fetch clinics:', error);
      setClinics([]); // Ensure empty array on error
      if (error.response?.status === 403) {
        toast.error('Vous n\'avez accès à aucune clinique');
      } else {
        toast.error('Erreur lors du chargement des cliniques');
      }
    }
  };

  const fetchRadiologists = async () => {
    try {
      const response = await usersAPI.getAll();
      const rads = response.data.filter(u => u.role === 'RADIOLOGIST');
      setRadiologists(rads);
    } catch (error) {
      console.error('Failed to fetch radiologists:', error);
    }
  };

  const fetchStudies = async (searchFilters = {}) => {
    if (!filters.clinicId && !searchFilters.clinicId) return;

    setLoading(true);
    try {
      const activeFilters = { ...filters, ...searchFilters };
      const response = await studiesAPI.getAll(activeFilters);
      setStudies(response.data);
    } catch (error) {
      console.error('Failed to fetch studies:', error);
      if (error.response?.status === 403) {
        toast.error('Accès refusé à cette clinique');
        // Clear the invalid clinic selection
        setFilters(prev => ({ ...prev, clinicId: '' }));
        setClinics([]);
      } else {
        toast.error('Échec du chargement des études');
      }
      setStudies([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchStudies();
  };

  const handleAssignStudy = async () => {
    if (!selectedStudy || !selectedRadiologist) {
      toast.error('Veuillez sélectionner un radiologue');
      return;
    }

    try {
      await reportsAPI.assign({
        studyInstanceUid: selectedStudy.studyInstanceUid,
        radiologistId: selectedRadiologist,
        patientName: selectedStudy.patientName,
        patientId: selectedStudy.patientId,
        studyDate: selectedStudy.studyDate,
        modality: selectedStudy.modality,
        studyDescription: selectedStudy.studyDescription,
        patientAge: selectedStudy.patientAge
      });

      toast.success('Étude assignée avec succès');
      setShowAssignModal(false);
      setSelectedStudy(null);
      setSelectedRadiologist('');
      fetchStudies();
    } catch (error) {
      console.error('Failed to assign study:', error);
      const errMsg = error.response?.data?.error || 'Erreur lors de l\'assignation';
      toast.error(errMsg);
    }
  };

  const handleDownloadPDF = async (study) => {
    try {
      const reportResponse = await reportsAPI.getByStudyUid(study.studyInstanceUid);
      if (!reportResponse.data || !reportResponse.data.data) {
        toast.error('Rapport non trouvé');
        return;
      }
      const report = reportResponse.data.data;
      const clinic = clinics.find(c => c._id === filters.clinicId);
      
      await generatePDF(report, clinic, study.patientAge);
      
      toast.success('PDF téléchargé avec succès');
    } catch (error) {
      console.error('Failed to download PDF:', error);
      toast.error('Erreur lors du téléchargement PDF');
    }
  };

  const handleDownloadWord = async (study) => {
    try {
      const reportResponse = await reportsAPI.getByStudyUid(study.studyInstanceUid);
      if (!reportResponse.data || !reportResponse.data.data) {
        toast.error('Rapport non trouvé');
        return;
      }
      const report = reportResponse.data.data;
      const clinic = clinics.find(c => c._id === filters.clinicId);
      
      await generateWordDocument(report, clinic, study.patientAge);
      
      toast.success('Document Word téléchargé avec succès');
    } catch (error) {
      console.error('Failed to download Word:', error);
      toast.error('Erreur lors du téléchargement Word');
    }
  };

  const handleRowDoubleClick = (study) => {
    setIsNavigating(true);
    const clinicParam = filters.clinicId ? `?clinicId=${filters.clinicId}` : '';
    router.push(`/reporting/${study.studyInstanceUid}${clinicParam}`);
  };

  const getFilteredStudies = () => {
    let result = studies;
    switch (activeFilter) {
      case 'unreported':
        result = result.filter(s => s.reportStatus === 'UNREPORTED');
        break;
      case 'draft':
        result = result.filter(s => s.reportStatus === 'DRAFT');
        break;
      case 'final':
        result = result.filter(s => s.reportStatus === 'FINAL');
        break;
      case 'assigned':
        result = result.filter(s => s.assignedTo?._id === user?._id);
        break;
    }
    if (filters.modality) {
      result = result.filter(s => s.modality && s.modality.includes(filters.modality));
    }
    return result;
  };

  const filteredStudies = getFilteredStudies();
  const indexOfLastStudy = currentPage * itemsPerPage;
  const indexOfFirstStudy = indexOfLastStudy - itemsPerPage;
  const currentStudies = filteredStudies.slice(indexOfFirstStudy, indexOfLastStudy);
  const totalPages = Math.ceil(filteredStudies.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  const getStatusBadge = (status) => {
    const badges = {
      UNREPORTED: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Non rapporté' },
      DRAFT: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Brouillon' },
      FINAL: { bg: 'bg-green-100', text: 'text-green-700', label: 'Finalisé' },
      ASSIGNED: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Assigné' }
    };
    return badges[status] || badges.UNREPORTED;
  };

  // --- MODIFIED FILTER BUTTONS LOGIC ---
  const isRestrictedUser = user && ['VIEWER', 'REFERRING_PHYSICIAN'].includes(user.role);
  let filterButtons = [];

  if (isRestrictedUser) {
    // Restricted users only see Finalized
    filterButtons = [
      { 
        id: 'final', 
        label: 'Finalisés', 
        icon: FileCheck, 
        count: studies.filter(s => s.reportStatus === 'FINAL').length 
      }
    ];
  } else {
    // Normal users see the full workflow
    filterButtons = [
      { id: 'all', label: 'Tous', icon: Inbox, count: studies.length },
      { id: 'unreported', label: 'Non rapportés', icon: FileX, count: studies.filter(s => s.reportStatus === 'UNREPORTED').length },
      { id: 'draft', label: 'Brouillons', icon: FileClock, count: studies.filter(s => s.reportStatus === 'DRAFT').length },
      { id: 'final', label: 'Finalisés', icon: FileCheck, count: studies.filter(s => s.reportStatus === 'FINAL').length },
    ];

    if (user?.role === 'RADIOLOGIST') {
      filterButtons.push({
        id: 'assigned',
        label: 'Assignés à moi',
        icon: UserPlus,
        count: studies.filter(s => s.assignedTo?._id === user?._id).length
      });
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {isNavigating && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[9999] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
            <p className="text-blue-900 font-medium">Ouverture du dossier patient...</p>
          </div>
        </div>
      )}

      <Navbar />

      <div className="flex h-[calc(100vh-64px)]">
        {/* Sidebar */}
        <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
          {clinics.length > 0 && (
            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block flex items-center gap-1">
                <Building2 size={14} /> Clinique Active
              </label>
              <div className="relative group">
                <select
                  value={filters.clinicId}
                  onChange={(e) => setFilters({ ...filters, clinicId: e.target.value })}
                  className="w-full pl-3 pr-8 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-900 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer hover:border-blue-300 transition-colors"
                >
                  {clinics.map((clinic) => (
                    <option key={clinic._id} value={clinic._id}>
                      {clinic.name}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                  <ChevronRight size={16} className="rotate-90" />
                </div>
              </div>
            </div>
          )}

          <div className="p-4 overflow-y-auto flex-1">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Statut des rapports</h2>
            <div className="space-y-1">
              {filterButtons.map((filter) => {
                const Icon = filter.icon;
                const isActive = activeFilter === filter.id;
                return (
                  <button
                    key={filter.id}
                    onClick={() => setActiveFilter(filter.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isActive
                      ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100'
                      : 'text-gray-700 hover:bg-gray-50'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={18} className={isActive ? 'text-blue-600' : 'text-gray-400'} />
                      <span>{filter.label}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                      {filter.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Filters Bar */}
          <div className="bg-white border-b border-gray-200 p-4 shrink-0 shadow-sm z-20">
            <form onSubmit={handleSearch} className="flex flex-wrap gap-3 items-center">
              <div className="flex-1 min-w-[200px] relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Nom du patient..."
                  value={filters.patientName}
                  onChange={(e) => setFilters({ ...filters, patientName: e.target.value })}
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="w-32">
                <input
                  type="text"
                  placeholder="ID"
                  value={filters.patientId}
                  onChange={(e) => setFilters({ ...filters, patientId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="w-40 relative">
                <Activity className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <select
                  value={filters.modality}
                  onChange={(e) => setFilters({ ...filters, modality: e.target.value })}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
                >
                  <option value="">Modalité</option>
                  {modalities.map((mod) => (
                    <option key={mod.code} value={mod.code}>{mod.code}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-36">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                    className="w-full pl-9 pr-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <span className="text-gray-400">-</span>
                <div className="relative w-36">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                    className="w-full pl-9 pr-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors flex items-center gap-2 text-sm shadow-sm"
              >
                <Filter size={16} />
                Filtrer
              </button>
            </form>
          </div>

          {/* Table Area */}
          <div className="flex-1 p-4 flex flex-col min-h-0 overflow-hidden bg-gray-50">
            {loading ? (
              <div className="flex justify-center items-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : clinics.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="mx-auto text-gray-400 mb-4" size={48} />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun accès aux cliniques</h3>
                <p className="text-gray-500 mb-2">Vous n&apos;avez accès à aucune clinique.</p>
                <p className="text-sm text-gray-400">Veuillez contacter votre administrateur pour obtenir les accès nécessaires.</p>
              </div>
            ) : !filters.clinicId ? (
              <div className="text-center py-12">
                <Inbox className="mx-auto text-gray-400 mb-4" size={48} />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune clinique sélectionnée</h3>
                <p className="text-gray-500">Veuillez sélectionner une clinique pour voir les études</p>
              </div>
            ) : filteredStudies.length === 0 ? (
              <div className="text-center py-12">
                <FileX className="mx-auto text-gray-400 mb-4" size={48} />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune étude trouvée</h3>
                <p className="text-gray-500">Essayez de modifier vos filtres de recherche</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col flex-1 min-h-0">
                <div className="flex-1 overflow-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Patient</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Âge</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Modalité</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Description</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Statut</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {currentStudies.map((study) => {
                        const statusBadge = getStatusBadge(study.reportStatus);
                        return (
                          <tr
                            key={study.studyInstanceUid}
                            onDoubleClick={() => handleRowDoubleClick(study)}
                            className="hover:bg-gray-50 cursor-pointer transition-colors"
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{study.patientName}</div>
                              <div className="text-xs text-gray-500">{study.patientId}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {study.patientAge || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {study.studyDate ? format(new Date(study.studyDate), 'dd/MM/yyyy') : '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded border border-blue-200">
                                {study.modality || 'N/A'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                              {study.studyDescription || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 text-xs font-medium rounded ${statusBadge.bg} ${statusBadge.text}`}>
                                {statusBadge.label}
                              </span>
                              {study.assignedTo && (
                                <div className="text-xs text-gray-500 mt-1">
                                  Assigné à {study.assignedTo.fullName}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex items-center justify-end gap-2">
                                {study.reportStatus === 'FINAL' && (
                                  <>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleDownloadPDF(study); }}
                                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                      title="Télécharger PDF"
                                    >
                                      <Download size={16} />
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleDownloadWord(study); }}
                                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                      title="Télécharger Word"
                                    >
                                      <FileText size={16} />
                                    </button>
                                  </>
                                )}
                                {user?.role === 'ADMIN' && study.reportStatus === 'UNREPORTED' && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedStudy(study);
                                      setShowAssignModal(true);
                                    }}
                                    className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                    title="Assigner"
                                  >
                                    <UserPlus size={16} />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleRowDoubleClick(study)}
                                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                  <ChevronRight size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="border-t border-gray-200 bg-white px-4 py-3 sm:px-6 shrink-0 rounded-b-lg">
                    <div className="flex items-center justify-between">
                      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm text-gray-700">
                            Affichage de <span className="font-medium">{indexOfFirstStudy + 1}</span> à <span className="font-medium">{Math.min(indexOfLastStudy, filteredStudies.length)}</span> sur <span className="font-medium">{filteredStudies.length}</span>
                          </p>
                        </div>
                        <div>
                          <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                            <button
                              onClick={() => paginate(currentPage - 1)}
                              disabled={currentPage === 1}
                              className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                            >
                              <span className="sr-only">Précédent</span>
                              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                            </button>
                            {Array.from({ length: totalPages }).map((_, idx) => {
                              const page = idx + 1;
                              if (totalPages > 10 && (page < currentPage - 2 || page > currentPage + 2) && page !== 1 && page !== totalPages) return null;
                              return (
                                <button
                                  key={page}
                                  onClick={() => paginate(page)}
                                  className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${currentPage === page
                                    ? 'z-10 bg-blue-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
                                    : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'
                                    }`}
                                >
                                  {page}
                                </button>
                              )
                            })}
                            <button
                              onClick={() => paginate(currentPage + 1)}
                              disabled={currentPage === totalPages}
                              className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                            >
                              <span className="sr-only">Suivant</span>
                              <ChevronRight className="h-5 w-5" aria-hidden="true" />
                            </button>
                          </nav>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAssignModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Assigner l&apos;étude</h3>
              <p className="text-sm text-gray-500 mt-1">Patient: {selectedStudy?.patientName}</p>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Sélectionner un radiologue</label>
              <select
                value={selectedRadiologist}
                onChange={(e) => setSelectedRadiologist(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Choisir --</option>
                {radiologists.map((rad) => (
                  <option key={rad._id} value={rad._id}>
                    {rad.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setShowAssignModal(false)} className="px-4 py-2 border rounded-lg">Annuler</button>
              <button onClick={handleAssignStudy} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Assigner</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}