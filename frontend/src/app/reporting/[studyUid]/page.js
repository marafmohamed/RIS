'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Monitor, Save, X, FileText, Download, LayoutGrid, ChevronDown } from 'lucide-react';
import ReportEditorV2 from '@/components/reporting/ReportEditorV2';
import OHIFViewer from '@/components/reporting/OHIFViewer';
import { reportsAPI, studiesAPI, templatesAPI } from '@/lib/api';
import { toast } from 'sonner';
import { exportToWord } from '@/utils/wordExport';
import { exportToPDF } from '@/utils/pdfExport';

export default function ReportingPage({ params }) {
  const router = useRouter();
  const { studyUid } = params;

  const [study, setStudy] = useState(null);
  const [existingReport, setExistingReport] = useState(null);
  const [reportData, setReportData] = useState({ technique: '', findings: '', conclusion: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewerDetached, setViewerDetached] = useState(false);
  const [viewerMode, setViewerMode] = useState('hidden'); // 'split', 'hidden', 'detached' - default to hidden
  const [detachedWindow, setDetachedWindow] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    loadStudyAndReport();
    loadCurrentUser();
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
          const report = reportResponse.data.data;
          setExistingReport(report);
          // Parse report content into sections
          const content = report.content || '';
          const parsedData = parseReportSections(content);
          setReportData(parsedData);
        } else if (reportResponse.data && reportResponse.data._id) {
          const report = reportResponse.data;
          setExistingReport(report);
          const parsedData = parseReportSections(report.content || '');
          setReportData(parsedData);
        } else {
          setExistingReport(null);
          setReportData({ technique: '', findings: '', conclusion: '' });
        }
      } catch (err) {
        console.log('No existing report found:', err.message);
        setExistingReport(null);
        setReportData({ technique: '', findings: '', conclusion: '' });
      }
    } catch (error) {
      console.error('Error loading study:', error);
      toast.error('Failed to load study data');
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentUser = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      setCurrentUser(user);
    } catch (error) {
      console.error('Failed to load user:', error);
    }
  };

  const handleApplyTemplate = async (template) => {
    try {
      // Set the report data with template content
      setReportData({
        technique: template.technique || '',
        findings: template.findings || '',
        conclusion: template.conclusion || ''
      });
      
      // Increment usage count
      await templatesAPI.incrementUsage(template._id);
      
      setShowTemplateMenu(false);
      toast.success(`Template "${template.name}" applied`);
    } catch (error) {
      console.error('Failed to apply template:', error);
      toast.error('Failed to apply template');
    }
  };

  // Extract plain text preview from HTML
  const getTextPreview = (html) => {
    if (!html) return '';
    if (typeof document === 'undefined') return '';
    const div = document.createElement('div');
    div.innerHTML = html;
    const text = div.textContent || div.innerText || '';
    return text.substring(0, 50) + (text.length > 50 ? '...' : '');
  };

  // Parse report content into technique, findings, and conclusion
  const parseReportSections = (content) => {
    if (!content) {
      return { technique: '', findings: '', conclusion: '' };
    }

    // Try to parse sections from div structure
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    
    const techniqueDiv = doc.querySelector('.technique');
    const findingsDiv = doc.querySelector('.findings');
    const conclusionDiv = doc.querySelector('.conclusion');

    return {
      technique: techniqueDiv ? techniqueDiv.innerHTML : '',
      findings: findingsDiv ? findingsDiv.innerHTML : content,
      conclusion: conclusionDiv ? conclusionDiv.innerHTML : ''
    };
  };

  // Combine sections into single content for storage
  const combineReportSections = (data) => {
    return `<div class="technique">${data.technique}</div><div class="findings">${data.findings}</div><div class="conclusion">${data.conclusion}</div>`;
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

  const handleDetachViewer = async () => {
    try {
      // Get Orthanc credentials
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${apiUrl}/settings/orthanc-credentials`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch credentials');
      }

      const credentials = await response.json();
      const ohifUrl = `${credentials.url}/ohif/viewer?StudyInstanceUIDs=${studyUid}`;
      
      const newWindow = window.open(
        ohifUrl,
        'OHIF_Viewer',
        'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no'
      );
      
      if (newWindow) {
        setDetachedWindow(newWindow);
        setViewerMode('detached');
        toast.success('Viewer opened in new window. Drag to second monitor.');
      } else {
        toast.error('Failed to open viewer. Please allow popups.');
      }
    } catch (error) {
      console.error('Detach viewer error:', error);
      toast.error('Failed to open viewer');
    }
  };

  const handleReattachViewer = () => {
    if (detachedWindow && !detachedWindow.closed) {
      detachedWindow.close();
    }
    setDetachedWindow(null);
    setViewerMode('split');
  };

  const toggleViewerMode = () => {
    setViewerMode(viewerMode === 'split' ? 'hidden' : 'split');
  };

  const handleSaveReport = async () => {
    const combinedContent = combineReportSections(reportData);
    
    if (!combinedContent.trim() || combinedContent === '<div class="technique"></div><div class="findings"></div><div class="conclusion"></div>') {
      toast.error('Report content cannot be empty');
      return;
    }

    try {
      setSaving(true);

      if (existingReport && existingReport._id) {
        // Update existing report
        await reportsAPI.update(existingReport._id, {
          content: combinedContent,
          status: 'DRAFT'
        });
        toast.success('Report updated successfully');
      } else {
        // Create new report
        const response = await reportsAPI.create({
          studyInstanceUid: study.studyInstanceUid,
          patientName: study.patientName,
          patientId: study.patientId,
          studyDescription: study.studyDescription,
          studyDate: study.studyDate,
          modality: study.modality,
          content: combinedContent,
          status: 'DRAFT'
        });
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
    const combinedContent = combineReportSections(reportData);
    
    if (!combinedContent.trim() || combinedContent === '<div class="technique"></div><div class="findings"></div><div class="conclusion"></div>') {
      toast.error('Report content cannot be empty');
      return;
    }

    try {
      setSaving(true);

      if (existingReport && existingReport._id) {
        await reportsAPI.update(existingReport._id, {
          content: combinedContent,
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
          content: combinedContent,
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
    const combinedContent = combineReportSections(reportData);
    
    if (!combinedContent.trim()) {
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
        combinedContent,
        study.patientName,
        study.patientId,
        study.studyDescription,
        study.studyDate,
        settings.HOSPITAL_NAME || settings.hospitalName || 'Medical Center',
        settings.FOOTER_TEXT || settings.footerText || ''
      );
      toast.success('Word document exported successfully');
      setShowExportMenu(false);
    } catch (error) {
      console.error('Export error:', error);
      toast.error(`Failed to export Word document: ${error.message}`);
    }
  };

  const handleExportPDF = async () => {
    const combinedContent = combineReportSections(reportData);
    
    if (!combinedContent.trim()) {
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
        combinedContent,
        study.patientName,
        study.patientId,
        study.studyDescription,
        study.studyDate,
        settings.HOSPITAL_NAME || settings.hospitalName || 'Medical Center',
        settings.FOOTER_TEXT || settings.footerText || ''
      );
      toast.success('PDF exported successfully');
      setShowExportMenu(false);
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
        <div className="flex items-center space-x-4">
          <div>
            <h1 className="text-lg font-bold">{study.patientName}</h1>
            <p className="text-sm text-blue-100">
              ID: {study.patientId || 'N/A'} • Âge: {calculateAge(study.patientBirthDate)} • {study.studyDescription}
            </p>
          </div>
          
          {/* Viewer Mode Buttons */}
          <div className="flex items-center space-x-2 border-l border-blue-500 pl-4">
            <button
              onClick={toggleViewerMode}
              className={`p-2 rounded hover:bg-blue-600 transition-colors ${viewerMode === 'split' ? 'bg-blue-800' : 'bg-blue-700'}`}
              title={viewerMode === 'split' ? 'Masquer le visualiseur' : 'Afficher la vue partagée'}
            >
              <LayoutGrid size={18} />
            </button>
            
            {viewerMode !== 'detached' ? (
              <button
                onClick={handleDetachViewer}
                className="p-2 rounded hover:bg-blue-600 transition-colors bg-blue-700"
                title="Détacher le visualiseur (Nouvelle fenêtre)"
              >
                <Monitor size={18} />
              </button>
            ) : (
              <button
                onClick={handleReattachViewer}
                className="p-2 rounded bg-blue-800 hover:bg-blue-900 transition-colors"
                title="Fermer le visualiseur externe"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Export Dropdown - VIEWER can export but not save */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={!reportData.findings.trim() && !reportData.technique.trim() && !reportData.conclusion.trim()}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium shadow disabled:opacity-50"
            >
              <Download size={18} />
              <span>Exporter</span>
              <ChevronDown size={16} />
            </button>
            
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl z-50 py-1">
                <button
                  onClick={handleExportWord}
                  className="w-full px-4 py-2 text-left text-gray-700 hover:bg-blue-50 flex items-center space-x-2"
                >
                  <FileText size={16} />
                  <span>Exporter en Word</span>
                </button>
                <button
                  onClick={handleExportPDF}
                  className="w-full px-4 py-2 text-left text-gray-700 hover:bg-blue-50 flex items-center space-x-2"
                >
                  <Download size={16} />
                  <span>Exporter en PDF</span>
                </button>
              </div>
            )}
          </div>

          {/* Save and Finalize - Only for RADIOLOGIST and ADMIN */}
          {currentUser?.role !== 'VIEWER' && (
            <>
              <button
                onClick={handleSaveReport}
                disabled={saving}
                className="flex items-center space-x-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium shadow disabled:opacity-50"
              >
                <Save size={18} />
                <span>{saving ? 'Enregistrement...' : 'Enregistrer le brouillon'}</span>
              </button>

              <button
                onClick={handleFinalizeReport}
                disabled={saving}
                className="flex items-center space-x-2 px-4 py-2 bg-white text-blue-700 rounded-lg hover:bg-blue-50 transition-colors font-bold shadow disabled:opacity-50"
              >
                <span>{saving ? 'Traitement...' : 'Finaliser le rapport'}</span>
              </button>
            </>
          )}

          <button
            onClick={() => router.push('/dashboard')}
            className="p-2 hover:bg-blue-800 rounded-lg transition-colors"
            title="Fermer"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Split Panel Layout */}
      <div className="flex-1 overflow-hidden">
        {viewerMode === 'split' ? (
          <PanelGroup direction="horizontal">
            {/* Left Panel - OHIF Viewer */}
            <Panel defaultSize={50} minSize={30}>
              <OHIFViewer studyUid={studyUid} />
            </Panel>

            {/* Resize Handle */}
            <PanelResizeHandle className="w-1 bg-gray-300 hover:bg-blue-500 transition-colors cursor-col-resize" />

            {/* Right Panel - Report Editor */}
            <Panel defaultSize={50} minSize={30}>
              <ReportEditorV2
                initialTechnique={reportData.technique}
                initialFindings={reportData.findings}
                initialConclusion={reportData.conclusion}
                onChange={setReportData}
                readOnly={currentUser?.role === 'VIEWER'}
                onTemplateApply={handleApplyTemplate}
              />
            </Panel>
          </PanelGroup>
        ) : (
          <ReportEditorV2
            initialTechnique={reportData.technique}
            initialFindings={reportData.findings}
            initialConclusion={reportData.conclusion}
            onChange={setReportData}
            readOnly={currentUser?.role === 'VIEWER'}
            onTemplateApply={handleApplyTemplate}
          />
        )}
      </div>
    </div>
  );
}
