'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { reportsAPI } from '@/lib/api';
import { FiStar, FiCheckCircle, FiEye, FiDownload, FiFilter } from 'react-icons/fi';
import { toast } from 'sonner';

export default function ReferringPhysicianDashboard() {
    const router = useRouter();
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, validated, not-validated
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedReport, setSelectedReport] = useState(null);
    const [showValidateModal, setShowValidateModal] = useState(false);
    const [showRateModal, setShowRateModal] = useState(false);
    const [validationFeedback, setValidationFeedback] = useState('');
    const [rating, setRating] = useState(0);
    const [ratingComment, setRatingComment] = useState('');
    const [currentUser, setCurrentUser] = useState(null);

    useEffect(() => {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user.role !== 'REFERRING_PHYSICIAN') {
            router.push('/dashboard');
            return;
        }
        setCurrentUser(user);
        fetchReports();
    }, []);

    const fetchReports = async () => {
        try {
            setLoading(true);
            const response = await reportsAPI.getAll();
            setReports(response.data);
        } catch (error) {
            console.error('Error fetching reports:', error);
            toast.error('Échec du chargement des rapports');
        } finally {
            setLoading(false);
        }
    };

    const handleValidate = async () => {
        try {
            await reportsAPI.validate(selectedReport._id, { feedback: validationFeedback });
            toast.success('Rapport validé avec succès');
            setShowValidateModal(false);
            setValidationFeedback('');
            fetchReports();
        } catch (error) {
            console.error('Validation error:', error);
            toast.error(error.response?.data?.error || 'Échec de la validation');
        }
    };

    const handleRate = async () => {
        try {
            await reportsAPI.rate(selectedReport._id, { rating, comment: ratingComment });
            toast.success('Note enregistrée avec succès');
            setShowRateModal(false);
            setRating(0);
            setRatingComment('');
            fetchReports();
        } catch (error) {
            console.error('Rating error:', error);
            toast.error(error.response?.data?.error || 'Échec de l\'enregistrement de la note');
        }
    };

    const isValidatedByMe = (report) => {
        return report.validatedBy?.some(v => v.userId === currentUser?._id);
    };

    const getMyRating = (report) => {
        return report.ratings?.find(r => r.userId === currentUser?._id);
    };

    const filteredReports = reports.filter(report => {
        const matchesSearch = report.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            report.patientId.toLowerCase().includes(searchTerm.toLowerCase());

        if (filter === 'validated') {
            return matchesSearch && isValidatedByMe(report);
        } else if (filter === 'not-validated') {
            return matchesSearch && !isValidatedByMe(report);
        }
        return matchesSearch;
    });

    const stats = {
        total: reports.length,
        validated: reports.filter(r => isValidatedByMe(r)).length,
        notValidated: reports.filter(r => !isValidatedByMe(r)).length,
    };

    return (
        <>
            <Navbar />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Rapports finalisés</h1>
                    <p className="mt-2 text-gray-600">
                        Consultez, validez et notez les rapports de radiologie
                    </p>
                </div>

                {/* Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="card">
                        <div className="flex items-center">
                            <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                                <FiEye className="h-6 w-6" />
                            </div>
                            <div className="ml-4">
                                <p className="text-sm text-gray-600">Total des rapports</p>
                                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="flex items-center">
                            <div className="p-3 rounded-full bg-green-100 text-green-600">
                                <FiCheckCircle className="h-6 w-6" />
                            </div>
                            <div className="ml-4">
                                <p className="text-sm text-gray-600">Validés</p>
                                <p className="text-2xl font-bold text-gray-900">{stats.validated}</p>
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="flex items-center">
                            <div className="p-3 rounded-full bg-yellow-100 text-yellow-600">
                                <FiFilter className="h-6 w-6" />
                            </div>
                            <div className="ml-4">
                                <p className="text-sm text-gray-600">Non validés</p>
                                <p className="text-2xl font-bold text-gray-900">{stats.notValidated}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="card mb-6">
                    <div className="flex flex-wrap items-center gap-4">
                        <input
                            type="text"
                            placeholder="Rechercher par patient ou ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="input flex-1 min-w-[200px]"
                        />

                        <div className="flex space-x-2">
                            {['all', 'validated', 'not-validated'].map((f) => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`px-4 py-2 rounded-md text-sm font-medium ${filter === f
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    {f === 'all' && 'Tous'}
                                    {f === 'validated' && 'Validés'}
                                    {f === 'not-validated' && 'Non validés'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Reports Table */}
                <div className="card overflow-hidden">
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
                                            Date
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Modalité
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Auteur
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Note moyenne
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
                                    {filteredReports.map((report) => {
                                        const validated = isValidatedByMe(report);
                                        const myRating = getMyRating(report);

                                        return (
                                            <tr key={report._id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-medium text-gray-900">{report.patientName}</div>
                                                    <div className="text-sm text-gray-500">ID: {report.patientId}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {new Date(report.studyDate).toLocaleDateString('fr-FR')}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {report.modality}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {report.authorName}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {report.averageRating > 0 ? (
                                                        <div className="flex items-center">
                                                            <FiStar className="text-yellow-400 mr-1" />
                                                            <span className="text-sm font-medium">{report.averageRating.toFixed(1)}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-sm text-gray-400">Non noté</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {validated ? (
                                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                                            <FiCheckCircle className="mr-1" /> Validé
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                                            Non validé
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                                    <button
                                                        onClick={() => router.push(`/reporting/${report.studyInstanceUid}`)}
                                                        className="text-blue-600 hover:text-blue-900"
                                                    >
                                                        <FiEye className="inline mr-1" /> Voir
                                                    </button>
                                                    {!validated && (
                                                        <button
                                                            onClick={() => {
                                                                setSelectedReport(report);
                                                                setShowValidateModal(true);
                                                            }}
                                                            className="text-green-600 hover:text-green-900"
                                                        >
                                                            <FiCheckCircle className="inline mr-1" /> Valider
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => {
                                                            setSelectedReport(report);
                                                            setRating(myRating?.rating || 0);
                                                            setRatingComment(myRating?.comment || '');
                                                            setShowRateModal(true);
                                                        }}
                                                        className="text-yellow-600 hover:text-yellow-900"
                                                    >
                                                        <FiStar className="inline mr-1" /> {myRating ? 'Modifier' : 'Noter'}
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
            </div>

            {/* Validate Modal */}
            {showValidateModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                        <h3 className="text-lg font-semibold mb-4">Valider le rapport</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Patient: <strong>{selectedReport?.patientName}</strong>
                        </p>

                        <div className="mb-4">
                            <label className="flex items-center">
                                <input type="checkbox" className="mr-2" required />
                                <span className="text-sm">Je confirme avoir examiné ce rapport</span>
                            </label>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Commentaire clinique (optionnel)
                            </label>
                            <textarea
                                value={validationFeedback}
                                onChange={(e) => setValidationFeedback(e.target.value)}
                                className="input w-full"
                                rows="3"
                                placeholder="Ajoutez vos commentaires..."
                            />
                        </div>

                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => {
                                    setShowValidateModal(false);
                                    setValidationFeedback('');
                                }}
                                className="btn btn-secondary"
                            >
                                Annuler
                            </button>
                            <button onClick={handleValidate} className="btn btn-primary">
                                Valider
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Rate Modal */}
            {showRateModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                        <h3 className="text-lg font-semibold mb-4">Noter le rapport</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Patient: <strong>{selectedReport?.patientName}</strong>
                        </p>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Qualité du rapport
                            </label>
                            <div className="flex space-x-2">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        onClick={() => setRating(star)}
                                        className="focus:outline-none"
                                    >
                                        <FiStar
                                            className={`h-8 w-8 ${star <= rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
                                                }`}
                                        />
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Commentaire (optionnel)
                            </label>
                            <textarea
                                value={ratingComment}
                                onChange={(e) => setRatingComment(e.target.value)}
                                className="input w-full"
                                rows="3"
                                placeholder="Commentaire sur la qualité..."
                            />
                        </div>

                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => {
                                    setShowRateModal(false);
                                    setRating(0);
                                    setRatingComment('');
                                }}
                                className="btn btn-secondary"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleRate}
                                disabled={rating === 0}
                                className="btn btn-primary disabled:opacity-50"
                            >
                                Enregistrer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
