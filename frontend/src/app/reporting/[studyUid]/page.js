'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Monitor, Save, X, FileText, Download } from 'lucide-react';
import ReportEditor from '@/components/reporting/ReportEditor';
import { reportsAPI, studiesAPI } from '@/lib/api';
import { toast } from 'sonner';
import { exportToWord } from '@/utils/wordExport';
import { exportToPDF } from '@/utils/pdfExport';

export default function ReportingPage({ params }) {
  const router = useRouter();
  const { studyUid } = params;

  const [study, setStudy] = useState(null);
  const [existingReport, setExistingReport] = useState(null);
  const [reportContent, setReportContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewerDetached, setViewerDetached] = useState(false);
  const [detachedWindow, setDetachedWindow] = useState(null);

  useEffect(() => {
    loadStudyAndReport();
  }, [studyUid]);

  useEffect(() => {
    // Clean up detached window on unmount
    return () => {
      if (detachedWindow && !detachedWindow.closed) {
        detachedWindow.close();
      }
    };
  }, [detachedWindow]);

  const loadStudyAndReport = async () => {
    try {
      setLoading(true);

      // Load study details
      const studyResponse = await studiesAPI.getByUid(studyUid);
      setStudy(studyResponse.data);

      // Check if report exists
      try {
        const reportResponse = await reportsAPI.getByStudyUid(studyUid);
        if (reportResponse.data && reportResponse.data.data) {
          // Backend wraps response in { data: report }
          setExistingReport(reportResponse.data.data);
          setReportContent(reportResponse.data.data.content || '');
        } else if (reportResponse.data && reportResponse.data._id) {
          // Direct report object
          setExistingReport(reportResponse.data);
          setReportContent(reportResponse.data.content || '');
        } else {
          // No report found
          setExistingReport(null);
          setReportContent('');
        }
      } catch (err) {
        // No existing report or error fetching it
        console.log('No existing report found:', err.message);
        setExistingReport(null);
        setReportContent('');
      }
    } catch (error) {
      console.error('Error loading study:', error);
      toast.error('Failed to load study data');
    } finally {
      setLoading(false);
    }
  };

  const calculateAge = (birthDate) => {
    if (!birthDate) return 'N/A';
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const handleDetachViewer = () => {
    const ohifUrl = `https://pacs.58wilaya.com/ohif/viewer?StudyInstanceUIDs=${studyUid}`;
    const newWindow = window.open(
      ohifUrl,
      'OHIF_Viewer',
      'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no'
    );
    
    if (newWindow) {
      setDetachedWindow(newWindow);
      setViewerDetached(true);
      toast.success('Viewer opened in new window. Drag to second monitor.');
    } else {
      toast.error('Failed to open viewer. Please allow popups.');
    }
  };

  const handleReattachViewer = () => {
    if (detachedWindow && !detachedWindow.closed) {
      detachedWindow.close();
    }
    setDetachedWindow(null);
    setViewerDetached(false);
  };

  const handleSaveReport = async () => {
    if (!reportContent.trim()) {
      toast.error('Report content cannot be empty');
      return;
    }

    try {
      setSaving(true);

      if (existingReport && existingReport._id) {
        // Update existing report
        const response = await reportsAPI.update(existingReport._id, {
          content: reportContent,
          status: 'DRAFT'
        });
        toast.success('Report updated successfully');
      } else {
        // Create new report
        const response = await reportsAPI.create({
          studyInstanceUid: study.studyInstanceUID,
          patientName: study.patientName,
          patientId: study.patientId,
          studyDescription: study.studyDescription,
          studyDate: study.studyDate,
          modality: study.modality,
          content: reportContent,
          status: 'DRAFT'
        });
        // Update the existing report with the newly created one
        if (response.data && response.data.report) {
          setExistingReport(response.data.report);
        }
        toast.success('Report created successfully');
      }
    } catch (error) {
      console.error('Error saving report:', error);
      toast.error(error.response?.data?.error || 'Failed to save report');
    } finally {
      setSaving(false);
    }
  };

  const handleFinalizeReport = async () => {
    if (!reportContent.trim()) {
      toast.error('Report content cannot be empty');
      return;
    }

    try {
      setSaving(true);

      if (existingReport && existingReport._id) {
        await reportsAPI.update(existingReport._id, {
          content: reportContent,
          status: 'FINAL'
        });
      } else {
        await reportsAPI.create({
          studyInstanceUid: study.studyInstanceUID,
          patientName: study.patientName,
          patientId: study.patientId,
          studyDescription: study.studyDescription,
          studyDate: study.studyDate,
          modality: study.modality,
          content: reportContent,
          status: 'FINAL'
        });
      }

      toast.success('Report finalized successfully');
      router.push('/dashboard/reports');
    } catch (error) {
      console.error('Error finalizing report:', error);
      toast.error(error.response?.data?.error || 'Failed to finalize report');
    } finally {
      setSaving(false);
    }
  };

  const handleExportWord = async () => {
    if (!reportContent.trim()) {
      toast.error('Report content is empty');
      return;
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      const settingsResponse = await fetch(`${apiUrl}/settings`);
      
      if (!settingsResponse.ok) {
        throw new Error('Failed to fetch settings');
      }
      
      const settings = await settingsResponse.json();

      await exportToWord(
        reportContent,
        study.patientName,
        study.patientId,
        study.studyDescription,
        study.studyDate,
        settings.HOSPITAL_NAME || settings.hospitalName || 'Medical Center',
        settings.FOOTER_TEXT || settings.footerText || ''
      );
      toast.success('Word document exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error(`Failed to export Word document: ${error.message}`);
    }
  };

  const handleExportPDF = async () => {
    if (!reportContent.trim()) {
      toast.error('Report content is empty');
      return;
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      const settingsResponse = await fetch(`${apiUrl}/settings`);
      
      if (!settingsResponse.ok) {
        throw new Error('Failed to fetch settings');
      }
      
      const settings = await settingsResponse.json();

      await exportToPDF(
        reportContent,
        study.patientName,
        study.patientId,
        study.studyDescription,
        study.studyDate,
        settings.HOSPITAL_NAME || settings.hospitalName || 'Medical Center',
        settings.FOOTER_TEXT || settings.footerText || ''
      );
      toast.success('PDF exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error(`Failed to export PDF: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading reporting workstation...</p>
        </div>
      </div>
    );
  }

  if (!study) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 text-xl">Study not found</p>
          <button
            onClick={() => router.push('/dashboard/reports')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Reports
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 shadow-lg flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <div>
            <h1 className="text-lg font-bold">{study.patientName}</h1>
            <p className="text-sm text-blue-100">
              ID: {study.patientId || 'N/A'} • Age: {calculateAge(study.patientBirthDate)} • {study.studyDescription}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {!viewerDetached ? (
            <button
              onClick={handleDetachViewer}
              className="flex items-center space-x-2 px-4 py-2 bg-white text-blue-700 rounded-lg hover:bg-blue-50 transition-colors font-medium shadow"
            >
              <Monitor size={18} />
              <span>Detach Viewer</span>
            </button>
          ) : (
            <button
              onClick={handleReattachViewer}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-800 text-white rounded-lg hover:bg-blue-900 transition-colors font-medium"
            >
              <X size={18} />
              <span>Close External Viewer</span>
            </button>
          )}

          {/* Export Buttons */}
          <button
            onClick={handleExportWord}
            disabled={!reportContent.trim()}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium shadow disabled:opacity-50"
            title="Export to Word"
          >
            <FileText size={18} />
            <span className="hidden md:inline">Word</span>
          </button>

          <button
            onClick={handleExportPDF}
            disabled={!reportContent.trim()}
            className="flex items-center space-x-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium shadow disabled:opacity-50"
            title="Export to PDF"
          >
            <Download size={18} />
            <span className="hidden md:inline">PDF</span>
          </button>

          <button
            onClick={handleSaveReport}
            disabled={saving}
            className="flex items-center space-x-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium shadow disabled:opacity-50"
          >
            <Save size={18} />
            <span>{saving ? 'Saving...' : 'Save Draft'}</span>
          </button>

          <button
            onClick={handleFinalizeReport}
            disabled={saving}
            className="flex items-center space-x-2 px-4 py-2 bg-white text-blue-700 rounded-lg hover:bg-blue-50 transition-colors font-bold shadow disabled:opacity-50"
          >
            <span>{saving ? 'Processing...' : 'Finalize Report'}</span>
          </button>

          <button
            onClick={() => router.push('/dashboard')}
            className="p-2 hover:bg-blue-800 rounded-lg transition-colors"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Split Panel Layout */}
      <div className="flex-1 overflow-hidden">
        {viewerDetached ? (
          // Full-width editor when viewer is detached
          <ReportEditor
            initialContent={reportContent}
            onChange={setReportContent}
          />
        ) : (
          // Split-screen layout
          <PanelGroup direction="horizontal">
            {/* Left Panel - OHIF Viewer */}
            <Panel defaultSize={50} minSize={30}>
              <div className="h-full bg-black">
                <iframe
                  src={`https://pacs.58wilaya.com/ohif/viewer?StudyInstanceUIDs=${studyUid}`}
                  className="w-full h-full border-0"
                  allow="fullscreen"
                  title="OHIF Viewer"
                />
              </div>
            </Panel>

            {/* Resize Handle */}
            <PanelResizeHandle className="w-1 bg-gray-300 hover:bg-blue-500 transition-colors cursor-col-resize" />

            {/* Right Panel - Report Editor */}
            <Panel defaultSize={50} minSize={30}>
              <ReportEditor
                initialContent={reportContent}
                onChange={setReportContent}
              />
            </Panel>
          </PanelGroup>
        )}
      </div>
    </div>
  );
}
