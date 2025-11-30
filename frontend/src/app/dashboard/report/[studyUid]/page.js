'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import RichTextEditor from '@/components/RichTextEditor';
import DicomViewer from '@/components/DicomViewer';
import { studiesAPI, reportsAPI, clinicsAPI } from '@/lib/api';
import { toast } from 'sonner';
import { FiSave, FiCheckCircle, FiArrowLeft, FiDownload, FiFileText } from 'react-icons/fi';
import { format } from 'date-fns';
import { downloadWordReport, getExamTemplate } from '@/utils/wordExport';
import { downloadPDFReport } from '@/utils/pdfExport';
import axios from 'axios';

export default function ReportPage() {
  const params = useParams();
  const router = useRouter();
  const studyUid = params.studyUid;

  const [study, setStudy] = useState(null);
  const [report, setReport] = useState(null);
  const [reportContent, setReportContent] = useState('');
  const [conclusion, setConclusion] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [defaultClinic, setDefaultClinic] = useState(null);

  useEffect(() => {
    fetchStudyAndReport();
    fetchDefaultClinic();
  }, [studyUid]);

  const fetchDefaultClinic = async () => {
    try {
      const response = await clinicsAPI.getAll();
      const defaultC = response.data.find(c => c.isDefault) || response.data[0];
      setDefaultClinic(defaultC);
    } catch (error) {
      console.error('Failed to fetch clinics:', error);
    }
  };

  const fetchStudyAndReport = async () => {
    setLoading(true);
    try {
      // Fetch study details
      const studyResponse = await studiesAPI.getByUid(studyUid);
      setStudy(studyResponse.data);

      // Check if report exists
      if (studyResponse.data.report) {
        setReport(studyResponse.data.report);
        setReportContent(studyResponse.data.report.content || '');
        setConclusion(studyResponse.data.report.conclusion || '');
      } else {
        // Initialize with template based on exam type
        const template = getExamTemplate(studyResponse.data.modality, studyResponse.data.studyDescription);
        setReportContent(template.findings);
        setConclusion(template.conclusion);
      }
    } catch (error) {
      console.error('Failed to fetch study:', error);
      toast.error('Failed to load study details');
    } finally {
      setLoading(false);
    }
  };

  const generateReportTemplate = (studyData) => {
    return `<h2>Clinical History</h2>
<p>[Enter clinical history here]</p>

<h2>Technique</h2>
<p>${studyData.modality || '[Modality]'} examination of ${studyData.studyDescription || '[Body Part]'}</p>

<h2>Findings</h2>
<p>[Enter findings here]</p>

<h2>Impression</h2>
<p>[Enter impression here]</p>`;
  };

  const handleSaveDraft = async () => {
    await saveReport('DRAFT');
  };

  const handleFinalize = async () => {
    if (!reportContent.trim()) {
      toast.error('Report content cannot be empty');
      return;
    }

    const confirmed = confirm('Are you sure you want to finalize this report? Finalized reports can only be edited by admins.');
    if (!confirmed) return;

    await saveReport('FINAL');
  };

  const saveReport = async (status) => {
    setSaving(true);
    try {
      const reportData = {
        studyInstanceUid: studyUid,
        patientName: study.patientName,
        patientId: study.patientId,
        studyDate: study.studyDate,
        modality: study.modality,
        studyDescription: study.studyDescription,
        content: reportContent,
        conclusion: conclusion,
        status: status
      };

      if (report) {
        // Update existing report
        await reportsAPI.update(report._id, reportData);
        toast.success(`Report ${status === 'DRAFT' ? 'saved as draft' : 'finalized'}`);
      } else {
        // Create new report
        const response = await reportsAPI.create(reportData);
        setReport(response.data.report);
        toast.success(`Report ${status === 'DRAFT' ? 'created as draft' : 'finalized'}`);
      }

      // Refresh data
      await fetchStudyAndReport();

      if (status === 'FINAL') {
        // Redirect back to worklist after finalizing
        setTimeout(() => router.push('/dashboard'), 1500);
      }
    } catch (error) {
      console.error('Save report error:', error);
      toast.error(error.response?.data?.error || 'Failed to save report');
    } finally {
      setSaving(false);
    }
  };

  const handleExportWord = async () => {
    setExporting(true);
    try {
      // Fetch current settings
      const token = localStorage.getItem('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      const settingsResponse = await axios.get(`${apiUrl}/settings?category=REPORT`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const reportData = {
        patientName: study.patientName,
        patientId: study.patientId,
        patientAge: study.patientAge, // Now comes from backend
        studyDescription: study.studyDescription,
        studyDate: study.studyDate,
        modality: study.modality,
        reportContent: reportContent,
        findings: reportContent,
        conclusion: conclusion,
      };

      const settings = {
        hospitalName: defaultClinic?.name || settingsResponse.data.HOSPITAL_NAME || "l'EPH MAZOUNA",
        footerText: defaultClinic?.address || settingsResponse.data.FOOTER_TEXT || 'Cité Bousrour en face les pompiers Mazouna Relizane   Tel 0779 00 46 56   حي بوسرور مقابل الحماية المدنية مازونة غليزان'
      };

      await downloadWordReport(reportData, defaultClinic, settings, study.patientAge);
      toast.success('Word document exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export Word document');
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      // Fetch current settings
      const token = localStorage.getItem('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      const settingsResponse = await axios.get(`${apiUrl}/settings?category=REPORT`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const reportData = {
        patientName: study.patientName,
        patientId: study.patientId,
        patientAge: study.patientAge, // Now comes from backend
        studyDescription: study.studyDescription,
        studyDate: study.studyDate,
        modality: study.modality,
        findings: reportContent,
        conclusion: conclusion,
      };

      const settings = {
        hospitalName: defaultClinic?.name || settingsResponse.data.HOSPITAL_NAME || "l'EPH MAZOUNA",
        footerText: defaultClinic?.address || settingsResponse.data.FOOTER_TEXT || 'Cité Bousrour en face les pompiers Mazouna Relizane   Tel 0779 00 46 56   حي بوسرور مقابل الحماية المدنية مازونة غليزان'
      };

      await downloadPDFReport(reportData, settings, defaultClinic, study.patientAge);
      toast.success('PDF exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export PDF');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading study...</p>
          </div>
        </div>
      </>
    );
  }

  if (!study) {
    return (
      <>
        <Navbar />
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <p className="text-red-600">Study not found</p>
            <button onClick={() => router.push('/dashboard')} className="mt-4 btn btn-primary">
              Back to Worklist
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />

      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-full px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="text-gray-600 hover:text-gray-900"
              >
                <FiArrowLeft className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {study.patientName}
                </h1>
                <p className="text-sm text-gray-600">
                  {study.patientId} • {study.modality} • {study.studyDate ? format(new Date(study.studyDate), 'MMM dd, yyyy') : 'N/A'}
                </p>
              </div>
            </div>

            <div className="flex space-x-3">
              {/* Export Buttons */}
              <button
                onClick={handleExportWord}
                disabled={exporting || !reportContent}
                className="btn bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
              >
                <FiDownload className="inline mr-2" />
                {exporting ? 'Exporting...' : 'Export Word'}
              </button>

              <button
                onClick={handleExportPDF}
                disabled={exporting || !reportContent}
                className="btn bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
              >
                <FiFileText className="inline mr-2" />
                {exporting ? 'Exporting...' : 'Export PDF'}
              </button>

              {/* Save Buttons */}
              {(!report || report.status === 'DRAFT') && (
                <button
                  onClick={handleSaveDraft}
                  disabled={saving}
                  className="btn btn-secondary"
                >
                  <FiSave className="inline mr-2" />
                  {saving ? 'Saving...' : 'Save Draft'}
                </button>
              )}

              {report?.status !== 'FINAL' && (
                <button
                  onClick={handleFinalize}
                  disabled={saving}
                  className="btn btn-primary"
                >
                  <FiCheckCircle className="inline mr-2" />
                  {saving ? 'Finalizing...' : 'Finalize Report'}
                </button>
              )}

              {report?.status === 'FINAL' && (
                <span className="px-4 py-2 bg-green-100 text-green-800 rounded-lg font-medium">
                  ✓ Finalized
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Split View */}
      <div className="flex h-[calc(100vh-180px)]">
        {/* Left Panel - DICOM Viewer */}
        <div className="w-1/2 border-r border-gray-300 bg-black">
          <DicomViewer studyUid={studyUid} />
        </div>

        {/* Right Panel - Report Editor */}
        <div className="w-1/2 bg-gray-50 overflow-y-auto">
          <div className="p-6">
            {/* Patient Info Header */}
            <div className="bg-white rounded-lg shadow-sm p-4 mb-4 border-2 border-gray-200">
              <h3 className="text-sm font-bold text-gray-700 mb-3 text-center bg-gray-100 py-2 rounded">
                IDENTIFICATION DU PATIENT
              </h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-semibold">Nom:</span> {study.patientName?.split('^')[0] || 'N/A'}
                </div>
                <div>
                  <span className="font-semibold">Prénom:</span> {study.patientName?.split('^')[1] || 'N/A'}
                </div>
                <div>
                  <span className="font-semibold">ID:</span> {study.patientId || 'N/A'}
                </div>
              </div>
            </div>

            {/* Exam Title */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-sm p-4 mb-4 border-2 border-blue-200">
              <h2 className="text-lg font-bold text-center text-blue-900 mb-1">
                INTERPRETATION DE {study.studyDescription?.toUpperCase() || study.modality?.toUpperCase()}
              </h2>
              <p className="text-sm text-center font-semibold text-blue-800">
                Examen réalisé au niveau de l&apos;EPH MAZOUNA
              </p>
            </div>

            <div className="mb-4">
              {report && (
                <div className="text-sm text-gray-600 bg-white p-3 rounded-lg shadow-sm">
                  <p><span className="font-semibold">Auteur:</span> {report.authorName}</p>
                  <p><span className="font-semibold">Dernière mise à jour:</span> {format(new Date(report.updatedAt), 'dd/MM/yyyy HH:mm')}</p>
                  <p>
                    <span className="font-semibold">Statut:</span>{' '}
                    <span className={`font-medium ${report.status === 'FINAL' ? 'text-green-600' : 'text-yellow-600'}`}>
                      {report.status}
                    </span>
                  </p>
                </div>
              )}
            </div>

            {/* Findings Section */}
            <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
              <h3 className="font-bold text-gray-900 mb-3 text-lg border-b pb-2">
                Résultats / Findings
              </h3>
              <RichTextEditor
                content={reportContent}
                onChange={setReportContent}
              />
            </div>

            {/* Conclusion Section */}
            <div className="bg-white rounded-lg shadow-sm p-4 mb-4 border-2 border-gray-300">
              <h3 className="font-bold text-gray-900 mb-3 text-lg">
                CONCLUSION
              </h3>
              <textarea
                value={conclusion}
                onChange={(e) => setConclusion(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-3 min-h-[100px] focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Entrez la conclusion ici..."
              />
            </div>



            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-2">Conseils:</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Utilisez l&apos;éditeur de texte enrichi pour formater votre rapport</li>
                <li>• Cliquez sur &lsquo;Export Word&lsquo; ou &lsquo;Export PDF&lsquo; pour télécharger le rapport professionnel</li>
                <li>• Sauvegardez en tant que brouillon pour continuer l&lsquo;édition plus tard</li>
                <li>• Finalisez le rapport quand il est prêt</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
