'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { 
  Monitor, 
  Save, 
  X, 
  FileText, 
  Download, 
  LayoutGrid, 
  ChevronDown, 
  ChevronUp, 
  Search, 
  GripHorizontal,
  HardDrive 
} from 'lucide-react';
import ReportEditorV2 from '@/components/reporting/ReportEditorV2';
import OHIFViewer from '@/components/reporting/OHIFViewer';
import ValidationHistory from '@/components/ValidationHistory';
import { reportsAPI, studiesAPI, templatesAPI, clinicsAPI } from '@/lib/api';
import { toast } from 'sonner';
import { exportToWord } from '@/utils/wordExport';
import { exportToPDF } from '@/utils/pdfExport';

export default function ReportingPage({ params }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clinicId = searchParams.get('clinicId');
  const { studyUid } = params;

  // Data State
  const [study, setStudy] = useState(null);
  const [existingReport, setExistingReport] = useState(null);
  const [reportData, setReportData] = useState({ technique: '', findings: '', conclusion: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Viewer and UI State
  const [viewerMode, setViewerMode] = useState('hidden'); // 'split', 'hidden', 'detached'
  const [detachedWindow, setDetachedWindow] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Templates State
  const [templates, setTemplates] = useState([]);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');

  // Context State
  const [activeClinic, setActiveClinic] = useState(null);

  // Validation History Terminal State
  const [showValidationHistory, setShowValidationHistory] = useState(false);

  useEffect(() => {
    loadStudyAndReport();
    loadCurrentUser();
    loadTemplates();
    loadActiveClinic();
  }, [studyUid, clinicId]);

  // Load the specific clinic selected in dashboard, or fallback to default
  const loadActiveClinic = async () => {
    try {
      const response = await clinicsAPI.getAll();
      let selectedClinic;

      // 1. Try to find clinic from URL param
      if (clinicId) {
        selectedClinic = response.data.find(c => c._id === clinicId);
      }

      // 2. Fallback to default if not found
      if (!selectedClinic) {
        selectedClinic = response.data.find(c => c.isDefault) || response.data[0];
      }

      setActiveClinic(selectedClinic);
    } catch (error) {
      console.error('Failed to fetch clinics:', error);
    }
  };

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
      console.log(studyResponse.data)
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
      toast.error('Échec du chargement des données de l\'étude');
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

  const loadTemplates = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (user.role !== 'VIEWER') {
        const response = await templatesAPI.getAll();
        setTemplates(response.data);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const handleApplyTemplate = async (template) => {
    try {
      // Set the report data with template content for ALL sections
      setReportData({
        technique: template.technique || '',
        findings: template.findings || '',
        conclusion: template.conclusion || ''
      });

      // Increment usage count
      await templatesAPI.incrementUsage(template._id);

      setShowTemplateMenu(false);
      setTemplateSearch('');
      // Standard application toast
      toast.success(`Modèle "${template.name}" appliqué`);
    } catch (error) {
      console.error('Failed to apply template:', error);
      toast.error('Échec de l\'application du modèle');
    }
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

  const handleDetachViewer = () => {
    // Get JWT token from localStorage
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

    if (!token) {
      toast.error('Authentification requise. Veuillez vous connecter.');
      return;
    }

    // Use the proxy's viewer endpoint which handles authentication server-side
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
    let viewerUrl = `${apiUrl}/proxy/viewer?StudyInstanceUIDs=${studyUid}&token=${token}`;
    if (clinicId) {
      viewerUrl += `&clinicId=${clinicId}`;
    }

    const newWindow = window.open(
      viewerUrl,
      'OHIF_Viewer',
      'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no'
    );

    if (newWindow) {
      setDetachedWindow(newWindow);
      setViewerMode('detached');
      toast.success('Visualiseur ouvert dans une nouvelle fenêtre');
    } else {
      toast.error('Échec de l\'ouverture du visualiseur. Veuillez autoriser les fenêtres contextuelles.');
    }
  };

  const handleReattachViewer = () => {
    if (detachedWindow && !detachedWindow.closed) {
      detachedWindow.close();
    }
    setDetachedWindow(null);
    setViewerMode('hidden');
  };

  const toggleViewerMode = () => {
    setViewerMode(viewerMode === 'split' ? 'hidden' : 'split');
  };

  const handleSaveReport = async () => {
    const combinedContent = combineReportSections(reportData);

    if (!combinedContent.trim() || combinedContent === '<div class="technique"></div><div class="findings"></div><div class="conclusion"></div>') {
      toast.error('Le contenu du rapport ne peut pas être vide');
      return;
    }

    try {
      setSaving(true);
      const age = calculateAge(study.patientBirthDate);

      const payload = {
        studyInstanceUid: study.studyInstanceUid || study.studyInstanceUID,
        patientName: study.patientName,
        patientId: study.patientId,
        studyDescription: study.studyDescription,
        studyDate: study.studyDate,
        modality: study.modality,
        content: combinedContent,
        status: 'DRAFT',
        patientAge: age !== 'N/A' ? age : study.patientAge
      };

      if (existingReport && existingReport._id) {
        // Update existing report
        await reportsAPI.update(existingReport._id, payload);
        toast.success('Rapport mis à jour avec succès');
      } else {
        // Create new report
        const response = await reportsAPI.create(payload);
        if (response.data && response.data.report) {
          setExistingReport(response.data.report);
        }
        toast.success('Rapport créé avec succès');
      }
    } catch (error) {
      console.error('Error saving report:', error);
      toast.error(error.response?.data?.error || 'Échec de l\'enregistrement du rapport');
    } finally {
      setSaving(false);
    }
  };

  const handleFinalizeReport = async () => {
    const combinedContent = combineReportSections(reportData);

    if (!combinedContent.trim() || combinedContent === '<div class="technique"></div><div class="findings"></div><div class="conclusion"></div>') {
      toast.error('Le contenu du rapport ne peut pas être vide');
      return;
    }

    try {
      setSaving(true);
      const age = calculateAge(study.patientBirthDate);

      const payload = {
        studyInstanceUid: study.studyInstanceUid || study.studyInstanceUID,
        patientName: study.patientName,
        patientId: study.patientId,
        studyDescription: study.studyDescription,
        studyDate: study.studyDate,
        modality: study.modality,
        content: combinedContent,
        status: 'FINAL',
        patientAge: age !== 'N/A' ? age : study.patientAge
      };

      if (existingReport && existingReport._id) {
        await reportsAPI.update(existingReport._id, payload);
      } else {
        await reportsAPI.create(payload);
      }

      toast.success('Rapport finalisé avec succès');
      router.push('/dashboard/reports');
    } catch (error) {
      console.error('Error finalizing report:', error);
      toast.error(error.response?.data?.error || 'Échec de la finalisation du rapport');
    } finally {
      setSaving(false);
    }
  };

  const handleExportWord = async () => {
    const combinedContent = combineReportSections(reportData);

    if (!combinedContent.trim()) {
      toast.error('Le contenu du rapport est vide');
      return;
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      const settingsResponse = await fetch(`${apiUrl}/settings`);

      if (!settingsResponse.ok) {
        throw new Error('Échec de la récupération des paramètres');
      }

      const settings = await settingsResponse.json();
      const age = calculateAge(study.patientBirthDate);

      await exportToWord(
        combinedContent,
        study.patientName,
        study.patientId,
        study.studyDescription,
        study.studyDate,
        settings.HOSPITAL_NAME || settings.hospitalName || 'Medical Center',
        settings.FOOTER_TEXT || settings.footerText || '',
        activeClinic, // Pass active clinic
        study.patientAge || 'N/A' // Fixed Age
      );
      toast.success('Document Word exporté avec succès');
      setShowExportMenu(false);
    } catch (error) {
      console.error('Export error:', error);
      toast.error(`Échec de l\'exportation du document Word : ${error.message}`);
    }
  };

  const handleExportPDF = async () => {
    const combinedContent = combineReportSections(reportData);

    if (!combinedContent.trim()) {
      toast.error('Le contenu du rapport est vide');
      return;
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      const settingsResponse = await fetch(`${apiUrl}/settings`);

      if (!settingsResponse.ok) {
        throw new Error('Échec de la récupération des paramètres');
      }

      const settings = await settingsResponse.json();
      const age = calculateAge(study.patientBirthDate);

      await exportToPDF(
        combinedContent,
        study.patientName,
        study.patientId,
        study.studyDescription,
        study.studyDate,
        settings.HOSPITAL_NAME || settings.hospitalName || 'Medical Center',
        settings.FOOTER_TEXT || settings.footerText || '',
        activeClinic, // Pass active clinic
        study.patientAge || 'N/A'
      );
      toast.success('PDF exporté avec succès');
      setShowExportMenu(false);
    } catch (error) {
      console.error('Export error:', error);
      toast.error(`Échec de l'exportation du PDF : ${error.message}`);
    }
  };

  const handleExportDICOM = async () => {
    try {
      // Create the URL for the download
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      
      // Get the token for authentication
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (!token) {
        toast.error('Vous devez être connecté pour télécharger');
        return;
      }

      // Construct URL with query parameters
      let downloadUrl = `${apiUrl}/proxy/export-dicom?studyUid=${studyUid}&token=${token}`;
      if (clinicId) {
        downloadUrl += `&clinicId=${clinicId}`;
      }

      // Trigger download by opening in a new (hidden) window or changing location
      // Using window.open allows the user to stay on the page while the download starts
      window.open(downloadUrl, '_blank');
      
      toast.success('Le téléchargement de l\'étude DICOM a commencé...');
      setShowExportMenu(false);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Erreur lors du lancement du téléchargement');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement du poste de travail de rapport...</p>
        </div>
      </div>
    );
  }

  if (!study) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 text-xl">Étude non trouvée</p>
          <button
            onClick={() => router.push('/dashboard/reports')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retour aux rapports
          </button>
        </div>
      </div>
    );
  }

  // Determine if the footer bar should appear
  const hasValidationHistory = existingReport && existingReport.status === 'FINAL' && (existingReport.validationCount > 0 || existingReport.averageRating > 0);

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* 1. Header Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 shadow-lg flex items-center justify-between flex-shrink-0 z-20">
        <div className="flex items-center space-x-3">
          <div className="min-w-0 flex-shrink">
            <h1 className="text-sm md:text-base font-bold truncate">{study.patientName}</h1>
            <p className="text-xs text-blue-100 truncate hidden sm:block">
              {/* FIXED AGE DISPLAY */}
              ID: {study.patientId || 'N/A'} • Âge: {study.patientAge || 'N/A'} • {study.studyDescription}
            </p>
            <p className="text-xs text-blue-100 truncate sm:hidden">
              ID: {study.patientId || 'N/A'}
            </p>
          </div>

          {/* Viewer Mode Buttons */}
          <div className="hidden sm:flex items-center space-x-1 border-l border-blue-500 pl-3">
            <button
              onClick={toggleViewerMode}
              className={`p-1.5 rounded hover:bg-blue-600 transition-colors ${viewerMode === 'split' ? 'bg-blue-800' : 'bg-blue-700'}`}
              title={viewerMode === 'split' ? 'Masquer le visualiseur' : 'Afficher la vue partagée'}
            >
              <LayoutGrid size={16} />
            </button>

            {viewerMode !== 'detached' ? (
              <button
                onClick={handleDetachViewer}
                className="p-1.5 rounded hover:bg-blue-600 transition-colors bg-blue-700"
                title="Détacher le visualiseur (Nouvelle fenêtre)"
              >
                <Monitor size={16} />
              </button>
            ) : (
              <button
                onClick={handleReattachViewer}
                className="p-1.5 rounded bg-blue-800 hover:bg-blue-900 transition-colors"
                title="Fermer le visualiseur externe"
              >
                <X size={16} />
              </button>
            )}

            {/* Export DICOM Button */}
            <button
              onClick={handleExportDICOM}
              className="p-1.5 rounded hover:bg-blue-600 transition-colors bg-blue-700"
              title="Télécharger l'étude DICOM (ZIP)"
            >
              <HardDrive size={16} />
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
          {/* Template Selector - Only for RADIOLOGIST and ADMIN */}
          {(currentUser?.role === 'RADIOLOGIST' || currentUser?.role === 'ADMIN') && templates.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowTemplateMenu(!showTemplateMenu)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm font-medium"
                title="Appliquer un modèle"
              >
                <FileText size={14} />
                <span className="hidden lg:inline">Modèles</span>
                <span className="text-xs bg-blue-400 px-1.5 py-0.5 rounded-full">{templates.length}</span>
              </button>

              {showTemplateMenu && (
                <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-gray-300 rounded-lg shadow-xl max-h-96 overflow-hidden z-50">
                  {/* Search Input */}
                  <div className="p-2 border-b border-gray-200 sticky top-0 bg-white">
                    <div className="relative">
                      <Search size={14} className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Rechercher..."
                        value={templateSearch}
                        onChange={(e) => setTemplateSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Templates List */}
                  <div className="overflow-y-auto max-h-80">
                    {templates.filter(t =>
                      t.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
                      (t.modality && t.modality.toLowerCase().includes(templateSearch.toLowerCase()))
                    ).length === 0 ? (
                      <div className="p-4 text-center text-gray-500 text-sm">
                        Aucun modèle trouvé
                      </div>
                    ) : (
                      templates.filter(t =>
                        t.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
                        (t.modality && t.modality.toLowerCase().includes(templateSearch.toLowerCase()))
                      ).map((template) => (
                        <button
                          key={template._id}
                          onClick={() => handleApplyTemplate(template)}
                          className="w-full px-3 py-2 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-900 text-sm truncate flex-1">{template.name}</span>
                            {template.isDefault && (
                              <span className="text-yellow-500 text-xs ml-2">★</span>
                            )}
                          </div>
                          {template.modality && (
                            <span className="inline-block text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded mt-1">
                              {template.modality}
                            </span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Export Dropdown - Everyone can export */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={!reportData.findings.trim() && !reportData.technique.trim() && !reportData.conclusion.trim()}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm font-medium disabled:opacity-50"
              title="Exporter le rapport"
            >
              <Download size={14} />
              <span className="hidden lg:inline">Exporter</span>
            </button>

            {showExportMenu && (
              <div className="absolute right-0 mt-1 w-44 bg-white rounded-lg shadow-xl z-50 py-1">
                <button
                  onClick={handleExportWord}
                  className="w-full px-3 py-1.5 text-left text-gray-700 hover:bg-blue-50 flex items-center gap-2 text-sm"
                >
                  <FileText size={14} />
                  <span>Word</span>
                </button>
                <button
                  onClick={handleExportPDF}
                  className="w-full px-3 py-1.5 text-left text-gray-700 hover:bg-blue-50 flex items-center gap-2 text-sm"
                >
                  <Download size={14} />
                  <span>PDF</span>
                </button>
              </div>
            )}
          </div>

          {/* Save and Finalize - Only for RADIOLOGIST and ADMIN */}
          {(currentUser?.role === 'RADIOLOGIST' || currentUser?.role === 'ADMIN') && (
            <>
              <button
                onClick={handleSaveReport}
                disabled={saving}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-green-500 text-white rounded hover:bg-green-600 transition-colors text-sm font-medium disabled:opacity-50"
                title="Enregistrer le brouillon"
              >
                <Save size={14} />
                <span className="hidden lg:inline">{saving ? 'Enregistrement...' : 'Brouillon'}</span>
              </button>

              <button
                onClick={handleFinalizeReport}
                disabled={saving}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white text-blue-700 rounded hover:bg-blue-50 transition-colors text-sm font-bold disabled:opacity-50"
                title="Finaliser le rapport"
              >
                <span className="hidden sm:inline">{saving ? 'Traitement...' : 'Finaliser'}</span>
                <span className="sm:hidden">✓</span>
              </button>
            </>
          )}

          <button
            onClick={() => router.push('/dashboard')}
            className="p-1.5 hover:bg-blue-800 rounded transition-colors"
            title="Fermer"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* 2. Main Vertical Split: Top (Workspace) & Bottom (Validation Terminal) */}
      <PanelGroup direction="vertical" className="flex-1 overflow-hidden">
        
        {/* Top Panel: Contains Viewer and Editor */}
        <Panel order={1} className="flex flex-col min-h-0">
          <div className="flex-1 overflow-hidden h-full relative">
            {viewerMode === 'split' ? (
              <PanelGroup direction="horizontal">
                {/* Left Panel - OHIF Viewer */}
                <Panel defaultSize={50} minSize={30}>
                  <OHIFViewer studyUid={studyUid} clinicId={clinicId} />
                </Panel>

                {/* Resize Handle */}
                <PanelResizeHandle className="w-1 bg-gray-300 hover:bg-blue-500 transition-colors cursor-col-resize z-10" />

                {/* Right Panel - Report Editor */}
                <Panel defaultSize={50} minSize={30}>
                  <ReportEditorV2
                    initialTechnique={reportData.technique}
                    initialFindings={reportData.findings}
                    initialConclusion={reportData.conclusion}
                    onChange={setReportData}
                    readOnly={currentUser?.role === 'VIEWER' || currentUser?.role === 'REFERRING_PHYSICIAN'}
                    onTemplateApply={handleApplyTemplate}
                    templates={templates}
                  />
                </Panel>
              </PanelGroup>
            ) : (
              <ReportEditorV2
                initialTechnique={reportData.technique}
                initialFindings={reportData.findings}
                initialConclusion={reportData.conclusion}
                onChange={setReportData}
                readOnly={currentUser?.role === 'VIEWER' || currentUser?.role === 'REFERRING_PHYSICIAN'}
                onTemplateApply={handleApplyTemplate}
                templates={templates}
              />
            )}
          </div>
        </Panel>

        {/* Validation History Resizable Section */}
        {showValidationHistory && hasValidationHistory && (
          <>
            <PanelResizeHandle className="h-2 bg-gray-100 hover:bg-blue-500 border-t border-gray-300 cursor-row-resize flex items-center justify-center transition-colors">
               <GripHorizontal size={14} className="text-gray-400" />
            </PanelResizeHandle>
            
            <Panel order={2} defaultSize={25} minSize={10} maxSize={100} className="bg-white flex flex-col min-h-0">
              <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200 sticky top-0">
                <h3 className="text-sm font-semibold text-gray-700">Historique de Validation</h3>
                <button 
                  onClick={() => setShowValidationHistory(false)}
                  className="p-1 hover:bg-gray-200 rounded text-gray-600"
                  title="Masquer"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
                <ValidationHistory report={existingReport} />
              </div>
            </Panel>
          </>
        )}
      </PanelGroup>

      {/* 3. Footer Toggle Bar (Visible if report is finalized and has history) */}
      {hasValidationHistory && (
        <div 
          onClick={() => setShowValidationHistory(!showValidationHistory)}
          className={`
            border-t border-gray-300 px-4 py-1.5 flex items-center justify-between cursor-pointer 
            text-xs font-medium select-none transition-colors flex-shrink-0
            ${showValidationHistory ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}
          `}
        >
          <div className="flex items-center gap-2">
            {showValidationHistory ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            <span>Historique de validation & Notes</span>
            <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px]">
              {existingReport.validationCount || 0}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}