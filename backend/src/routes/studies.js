const express = require("express");
const { authMiddleware } = require("../middleware/auth");
const OrthancService = require("../services/orthancService");
const Report = require("../models/Report");
const Clinic = require("../models/Clinic");

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Helper to get Orthanc service instance
async function getOrthancService(clinicId, user) {
  // Security Check: If user is not ADMIN, check if they have access to this clinic
  if (user && user.role !== "ADMIN" && clinicId) {
    const allowedIds = (user.allowedClinics || []).map((id) => id.toString());
    if (!allowedIds.includes(clinicId)) {
      throw new Error("ACCESS_DENIED");
    }
  }

  if (clinicId) {
    const clinic = await Clinic.findById(clinicId);
    if (clinic) {
      return OrthancService.fromClinic(clinic);
    }
  }

  // Try to find default clinic
  const defaultClinic = await Clinic.findOne({ isDefault: true });
  if (defaultClinic) {
    return OrthancService.fromClinic(defaultClinic);
  }

  // Fallback to env vars
  return new OrthancService();
}

// Get all studies with report status
router.get("/", async (req, res) => {
  try {
    const { patientName, patientId, startDate, endDate, clinicId, modality, quickFilter } =
      req.query;

    const orthancService = await getOrthancService(clinicId, req.user);
    let orthancStudies = [];

    // 1. Determine Search Strategy
    if (patientName) {
      orthancStudies = await orthancService.searchStudiesByPatientName(patientName);
    } else if (patientId) {
      orthancStudies = await orthancService.searchStudiesByPatientID(patientId);
    } else {
      // DATE LOGIC - Default to TODAY if nothing specified
      let start = startDate;
      let end = endDate;

      // Logic for Quick Filters (controlled by Frontend or Default)
      if (!startDate && !endDate && !patientName && !patientId) {
        if (quickFilter === 'all') {
          // Fetch ALL studies without date restriction
          start = undefined;
          end = undefined;
        } else {
          const today = new Date();
          const year = today.getFullYear();
          const month = String(today.getMonth() + 1).padStart(2, '0');
          const day = String(today.getDate()).padStart(2, '0');
          const todayStr = `${year}${month}${day}`;

          if (quickFilter === 'week') {
            const lastWeek = new Date(today);
            lastWeek.setDate(today.getDate() - 7);
            const weekYear = lastWeek.getFullYear();
            const weekMonth = String(lastWeek.getMonth() + 1).padStart(2, '0');
            const weekDay = String(lastWeek.getDate()).padStart(2, '0');
            start = `${weekYear}${weekMonth}${weekDay}`;
            end = todayStr;
          } else {
            // Default to TODAY
            start = todayStr;
            end = todayStr;
          }
        }
      }

      orthancStudies = await orthancService.searchStudiesByDate(start, end);
    }

    // 2. Parse Studies (Fast, no extra HTTP requests)
    let studies = orthancStudies.map((rawStudy) =>
      orthancService.parseStudy(rawStudy)
    );

    // 3. Filter by Modality (Backend Side as fallback)
    if (modality) {
      studies = studies.filter(
        (s) => s.modality && s.modality.includes(modality)
      );
    }

    // 4. Get all reports for these studies to merge status
    const studyUids = studies.map((s) => s.studyInstanceUid);

    // Build report filter based on user role
    const reportFilter = { studyInstanceUid: { $in: studyUids } };

    // VIEWER and REFERRING_PHYSICIAN: Only see FINAL reports (no author filter)
    // RADIOLOGIST: Only see their own reports
    // ADMIN: See all reports
    if (req.user.role === "VIEWER" || req.user.role === "REFERRING_PHYSICIAN") {
      reportFilter.status = "FINAL";
    } else if (req.user.role !== "ADMIN") {
      reportFilter.authorId = req.user._id;
    }

    const reports = await Report.find(reportFilter)
      .select(
        "studyInstanceUid status authorName authorId updatedAt assignedTo assignedBy assignedAt validatedBy ratings averageRating validationCount"
      )
      .populate("assignedTo", "fullName")
      .populate("assignedBy", "fullName");

    // Create a map of studyUid -> report for O(1) lookup
    const reportMap = {};
    reports.forEach((report) => {
      reportMap[report.studyInstanceUid] = {
        status: report.status,
        authorName: report.authorName,
        updatedAt: report.updatedAt,
        authorId: report.authorId,
        assignedTo: report.assignedTo,
        assignedBy: report.assignedBy,
        assignedAt: report.assignedAt,
        validatedBy: report.validatedBy,
        ratings: report.ratings,
        averageRating: report.averageRating,
        validationCount: report.validationCount,
      };
    });

    // 5. Merge study data with report status
    let studiesWithStatus = studies.map((study) => {
      const report = reportMap[study.studyInstanceUid];
      return {
        ...study,
        reportStatus: report?.status || "UNREPORTED",
        reportAuthor: report?.authorName || null,
        reportUpdatedAt: report?.updatedAt || null,
        reportAuthorId: report?.authorId || null,
        assignedTo: report?.assignedTo || null,
        assignedBy: report?.assignedBy || null,
        assignedAt: report?.assignedAt || null,
        validatedBy: report?.validatedBy || [],
        ratings: report?.ratings || [],
        averageRating: report?.averageRating || 0,
        validationCount: report?.validationCount || 0,
      };
    });

    // 6. Role based final filtering
    if (req.user.role === "VIEWER" || req.user.role === "REFERRING_PHYSICIAN") {
      // Only show studies with FINAL reports
      studiesWithStatus = studiesWithStatus.filter(
        (study) => study.reportStatus === "FINAL"
      );
    } else if (req.user.role !== "ADMIN") {
      // RADIOLOGIST: Show unreported studies or their own reports or assigned studies
      studiesWithStatus = studiesWithStatus.filter(
        (study) =>
          study.reportStatus === "UNREPORTED" ||
          study.reportAuthorId?.toString() === req.user._id.toString() ||
          study.assignedTo?._id?.toString() === req.user._id.toString()
      );
    }

    // 7. Sort by study date (newest first)
    studiesWithStatus.sort((a, b) => {
      if (!a.studyDate) return 1;
      if (!b.studyDate) return -1;
      return new Date(b.studyDate) - new Date(a.studyDate);
    });

    res.json(studiesWithStatus);
  } catch (error) {
    if (error.message === "ACCESS_DENIED") {
      return res
        .status(403)
        .json({ error: "You do not have access to this clinic" });
    }
    console.error("Get studies error:", error);
    res.status(500).json({ error: "Failed to fetch studies from PACS" });
  }
});

// Get specific study details
router.get("/:studyUid", async (req, res) => {
  try {
    const { studyUid } = req.params;
    const { clinicId } = req.query;
    console.log(
      "Fetching details for study UID:",
      studyUid,
      "in clinic ID:",
      clinicId
    );
    const orthancService = await getOrthancService(clinicId, req.user);

    // Find the study in Orthanc by StudyInstanceUID
    const searchResults = await orthancService.findStudies({
      StudyInstanceUID: studyUid,
    });

    if (searchResults.length === 0) {
      return res.status(404).json({ error: "Study not found in PACS" });
    }

    const orthancStudy = searchResults[0];

    // Use the Service parser here too
    const study = orthancService.parseStudy(orthancStudy);

    // Get report if exists
    const report = await Report.findOne({ studyInstanceUid: studyUid });

    res.json({
      ...study,
      report: report || null,
    });
  } catch (error) {
    if (error.message === "ACCESS_DENIED") {
      return res
        .status(403)
        .json({ error: "You do not have access to this clinic" });
    }
    console.error("Get study details error:", error);
    res.status(500).json({ error: "Failed to fetch study details" });
  }
});

// Get available DICOM nodes
router.get("/tools/modalities", async (req, res) => {
  try {
    const { clinicId } = req.query;
    const orthancService = await getOrthancService(clinicId, req.user);
    const modalities = await orthancService.getModalities();
    res.json(modalities);
  } catch (error) {
    console.error("Error fetching modalities:", error);
    res.status(500).json({ error: "Failed to load DICOM nodes" });
  }
});

// Send study to DICOM node
router.post("/:studyUid/send", async (req, res) => {
  try {
    const { studyUid } = req.params;
    const { targetAet, clinicId } = req.body;

    if (!targetAet) {
      return res.status(400).json({ 
        error: "Destination manquante",
        detail: "Veuillez sélectionner un nœud DICOM de destination"
      });
    }

    const orthancService = await getOrthancService(clinicId, req.user);
    
    // Get the Orthanc UUID (ID), not the DICOM StudyInstanceUID
    const search = await orthancService.findStudies({ StudyInstanceUID: studyUid });
    
    if (!search || search.length === 0) {
      return res.status(404).json({ 
        error: "Étude introuvable",
        detail: "L'étude demandée n'existe pas dans le PACS"
      });
    }
    
    const orthancId = search[0].ID;
    
    // Send study and get job ID for progress tracking
    const result = await orthancService.sendStudyToModality(orthancId, targetAet);
    
    res.json({ 
      success: true, 
      message: `Envoi vers ${targetAet} démarré`,
      jobId: result.ID,
      path: result.Path
    });
  } catch (error) {
    console.error("Error sending study:", error);
    
    const errorMsg = error.message || '';
    
    // Provide specific error messages based on error type
    if (errorMsg.includes('ECONNREFUSED')) {
      return res.status(503).json({ 
        error: "Serveur PACS indisponible",
        detail: "Impossible de se connecter au serveur PACS. Vérifiez que le serveur est en ligne."
      });
    }
    
    if (errorMsg.includes('404') || errorMsg.includes('Unknown modality')) {
      return res.status(404).json({ 
        error: "Nœud DICOM non configuré",
        detail: `Le nœud DICOM "${targetAet}" n'existe pas dans la configuration Orthanc. Veuillez d'abord configurer ce nœud dans Orthanc (Configuration → Modalities).`
      });
    }
    
    if (errorMsg.includes('timeout') || errorMsg.includes('aborted')) {
      return res.status(504).json({ 
        error: "Délai d'attente dépassé",
        detail: "L'opération a pris trop de temps. Le serveur distant ne répond pas."
      });
    }
    
    // Check for DICOM network errors (500 errors from Orthanc usually indicate DICOM protocol issues)
    if (errorMsg.includes('500')) {
      // Common causes of 500 errors when sending DICOM
      if (errorMsg.toLowerCase().includes('association') || errorMsg.toLowerCase().includes('connection')) {
        return res.status(500).json({ 
          error: "Échec de connexion DICOM",
          detail: "Impossible d'établir une connexion DICOM avec le nœud distant. Causes possibles:\n• Le nœud DICOM n'est pas configuré correctement\n• L'adresse IP ou le port est incorrect\n• Le serveur distant n'accepte pas les connexions\n• Le AE Title (Application Entity) ne correspond pas"
        });
      }
      
      return res.status(500).json({ 
        error: "Erreur du serveur PACS",
        detail: `Le serveur PACS a rencontré une erreur lors de l'envoi. Causes possibles:\n• Le nœud DICOM "${targetAet}" n'est pas configuré dans Orthanc\n• Les paramètres réseau (IP, Port, AE Title) sont incorrects\n• Le serveur distant refuse la connexion\n• Vérifiez la configuration dans Orthanc: Configuration → Modalities`
      });
    }
    
    // Generic error
    res.status(500).json({ 
      error: "Échec de l'envoi DICOM",
      detail: errorMsg || "Une erreur inattendue s'est produite lors de l'envoi de l'étude."
    });
  }
});

// Get job status for progress tracking
router.get("/jobs/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    const { clinicId } = req.query;
    
    const orthancService = await getOrthancService(clinicId, req.user);
    const jobStatus = await orthancService.getJobStatus(jobId);
    
    res.json(jobStatus);
  } catch (error) {
    console.error("Error fetching job status:", error);
    res.status(500).json({ error: "Failed to fetch job status" });
  }
});

// Test Orthanc connection
router.get("/test/connection", async (req, res) => {
  try {
    const { clinicId } = req.query;
    const orthancService = await getOrthancService(clinicId, req.user);

    const systemInfo = await orthancService.getSystemInfo();
    res.json({
      connected: true,
      version: systemInfo.Version,
      name: systemInfo.Name,
    });
  } catch (error) {
    res.status(500).json({
      connected: false,
      error: error.message,
    });
  }
});

module.exports = router;
