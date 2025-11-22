'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { studiesAPI } from '@/lib/api';
import { toast } from 'sonner';
import { FiSearch, FiFileText, FiCalendar, FiFilter } from 'react-icons/fi';
import { format } from 'date-fns';

export default function DashboardPage() {
  const [studies, setStudies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    patientName: '',
    patientId: '',
    startDate: '',
    endDate: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  useEffect(() => {
    fetchStudies();
  }, []);

  const fetchStudies = async (searchFilters = {}) => {
    setLoading(true);
    try {
      const response = await studiesAPI.getAll(searchFilters);
      setStudies(response.data);
    } catch (error) {
      console.error('Failed to fetch studies:', error);
      toast.error('Failed to load studies');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const searchParams = {};
    if (filters.patientName) searchParams.patientName = filters.patientName;
    if (filters.patientId) searchParams.patientId = filters.patientId;
    if (filters.startDate) searchParams.startDate = filters.startDate;
    if (filters.endDate) searchParams.endDate = filters.endDate;
    fetchStudies(searchParams);
  };

  const getStatusBadge = (status) => {
    const badges = {
      UNREPORTED: 'bg-gray-100 text-gray-800',
      DRAFT: 'bg-yellow-100 text-yellow-800',
      FINAL: 'bg-green-100 text-green-800'
    };
    return badges[status] || badges.UNREPORTED;
  };

  // Pagination calculations
  const indexOfLastStudy = currentPage * itemsPerPage;
  const indexOfFirstStudy = indexOfLastStudy - itemsPerPage;
  const currentStudies = studies.slice(indexOfFirstStudy, indexOfLastStudy);
  const totalPages = Math.ceil(studies.length / itemsPerPage);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [studies.length]);

  return (
    <>
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Worklist</h1>
          <p className="mt-2 text-gray-600">View and report patient studies from PACS</p>
        </div>

        {/* Search Filters */}
        <div className="card mb-6">
          <form onSubmit={handleSearch}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FiSearch className="inline mr-1" />
                  Patient Name
                </label>
                <input
                  type="text"
                  value={filters.patientName}
                  onChange={(e) => setFilters({ ...filters, patientName: e.target.value })}
                  placeholder="Search by name..."
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Patient ID
                </label>
                <input
                  type="text"
                  value={filters.patientId}
                  onChange={(e) => setFilters({ ...filters, patientId: e.target.value })}
                  placeholder="Search by ID..."
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FiCalendar className="inline mr-1" />
                  Start Date
                </label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  className="input"
                />
              </div>
            </div>

            <div className="mt-4 flex space-x-3">
              <button type="submit" className="btn btn-primary">
                <FiFilter className="inline mr-2" />
                Apply Filters
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilters({ patientName: '', patientId: '', startDate: '', endDate: '' });
                  fetchStudies();
                }}
                className="btn btn-secondary"
              >
                Clear
              </button>
            </div>
          </form>
        </div>

        {/* Studies Table */}
        <div className="card overflow-hidden">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading studies...</p>
            </div>
          ) : studies.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No studies found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Patient Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Patient ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Study Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Modality
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentStudies.map((study) => (
                    <tr key={study.studyInstanceUid} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {study.patientName}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{study.patientId}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {study.studyDate ? format(new Date(study.studyDate), 'MMM dd, yyyy') : 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                          {study.modality || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-500 max-w-xs truncate">
                          {study.studyDescription || 'No description'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(study.reportStatus)}`}>
                          {study.reportStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <Link
                          href={`/dashboard/report/${study.studyInstanceUid}`}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <FiFileText className="inline mr-1" />
                          {study.reportStatus === 'UNREPORTED' ? 'Create Report' : 'View Report'}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {!loading && studies.length > 0 && totalPages > 1 && (
          <div className="card mt-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {indexOfFirstStudy + 1} to {Math.min(indexOfLastStudy, studies.length)} of {studies.length} studies
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 rounded-md border border-gray-300 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
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
                        className={`px-3 py-1 rounded-md text-sm font-medium ${
                          currentPage === page
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
                        className={`px-3 py-1 rounded-md text-sm font-medium ${
                          currentPage === page
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
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 text-sm text-gray-600">
          Total studies: {studies.length}
        </div>
      </div>
    </>
  );
}
