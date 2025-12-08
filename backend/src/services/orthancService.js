const fetch = require('node-fetch');
const { decrypt } = require('../utils/encryption');

class OrthancService {
  constructor(config = null) {
    if (config) {
      this.baseUrl = config.url;
      this.username = config.username;
      this.password = config.password;
      this.authHeader = 'Basic ' + Buffer.from(`${this.username}:${this.password}`).toString('base64');
    } else {
      this.baseUrl = process.env.ORTHANC_URL;
      this.username = process.env.ORTHANC_USERNAME;
      this.password = process.env.ORTHANC_PASSWORD;
      this.authHeader = 'Basic ' + Buffer.from(`${this.username}:${this.password}`).toString('base64');
    }
  }

  static fromClinic(clinic) {
    if (!clinic.orthancUrl) {
      return new OrthancService();
    }
    let decryptedPassword = '';
    if (clinic.orthancPassword) {
      decryptedPassword = decrypt(clinic.orthancPassword);
    }
    return new OrthancService({
      url: clinic.orthancUrl,
      username: clinic.orthancUsername,
      password: decryptedPassword
    });
  }

  async makeRequest(endpoint, options = {}) {
    try {
      // Set a timeout for fetch requests to avoid hanging
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

      const url = `${this.baseUrl}${endpoint}`;
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Authorization': this.authHeader,
          'Content-Type': 'application/json',
          ...options.headers
        }
      });
      
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Orthanc API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Orthanc request error:', error.message);
      throw error; // Propagate to route handler
    }
  }

  /**
   * Optimized Find Studies
   * Pushes filtering logic to Orthanc DB instead of Node memory
   */
  async findStudies(query = {}) {
    const searchQuery = {
      Level: 'Study',
      Expand: true,
      Query: { ...query },
      RequestedTags: [
        "ModalitiesInStudy",
        "StudyDescription",
        "PatientAge",
        "NumberOfStudyRelatedSeries"
      ]
    };

    try {
      const studies = await this.makeRequest('/tools/find', {
        method: 'POST',
        body: JSON.stringify(searchQuery)
      });
      console.log(studies)
      
      return studies;
    } catch (error) {
      console.error("Error finding studies:", error);
      return [];
    }
  }

  async getStudyDetails(studyId) {
    return await this.makeRequest(`/studies/${studyId}`);
  }

  async getSystemInfo() {
    return await this.makeRequest('/system');
  }

  // Get list of configured DICOM nodes (AETs)
  async getModalities() {
    return await this.makeRequest('/modalities');
  }

  // Send a specific study to a target modality
  async sendStudyToModality(studyId, targetAet) {
    return await this.makeRequest(`/modalities/${targetAet}/store`, {
      method: 'POST',
      body: JSON.stringify(studyId)
    });
  }

  // Optimized Date Search
  async searchStudiesByDate(startDate, endDate) {
    const dateQuery = {};
    const cleanStart = startDate ? startDate.replace(/-/g, '') : '';
    const cleanEnd = endDate ? endDate.replace(/-/g, '') : '';

    if (cleanStart && cleanEnd) {
      dateQuery.StudyDate = `${cleanStart}-${cleanEnd}`;
    } else if (cleanStart) {
      dateQuery.StudyDate = `${cleanStart}-`;
    } else if (cleanEnd) {
      dateQuery.StudyDate = `-${cleanEnd}`;
    }
    
    return await this.findStudies(dateQuery);
  }

  async searchStudiesByPatientName(patientName) {
    return await this.findStudies({ PatientName: `*${patientName}*` });
  }

  async searchStudiesByPatientID(patientId) {
    return await this.findStudies({ PatientID: `*${patientId}*` });
  }

  parseStudy(orthancStudy) {
    const mainDicomTags = orthancStudy.MainDicomTags || {};
    const patientMainDicomTags = orthancStudy.PatientMainDicomTags || {};
    const requestedTags = orthancStudy.RequestedTags || {};

    // 1. Modality Extraction - Check RequestedTags first
    let modality = requestedTags.ModalitiesInStudy || 
                   orthancStudy.ModalitiesInStudy || 
                   mainDicomTags.ModalitiesInStudy || 
                   mainDicomTags.Modality || 
                   'Unknown';
    
    if (Array.isArray(modality)) {
      modality = modality.join('/');
    }

    // 2. Age Extraction - Check RequestedTags first
    let age = requestedTags.PatientAge || 
              patientMainDicomTags.PatientAge || 
              mainDicomTags.PatientAge;
    
    // Calculate age if missing and we have birth date
    if ((!age || age === '000') && patientMainDicomTags.PatientBirthDate) {
        age = this.calculateAge(patientMainDicomTags.PatientBirthDate, mainDicomTags.StudyDate);
    }

    return {
      studyInstanceUid: mainDicomTags.StudyInstanceUID || '',
      orthancId: orthancStudy.ID || '',
      patientName: (patientMainDicomTags.PatientName || 'Unknown').replace(/\^/g, ' ').trim(),
      patientId: patientMainDicomTags.PatientID || '',
      patientBirthDate: patientMainDicomTags.PatientBirthDate || '',
      patientAge: age || '',
      studyDate: this.parseDicomDate(mainDicomTags.StudyDate),
      studyTime: mainDicomTags.StudyTime || '',
      studyDescription: mainDicomTags.StudyDescription || '',
      modality: modality || 'Unknown', 
      accessionNumber: mainDicomTags.AccessionNumber || '',
      institutionName: mainDicomTags.InstitutionName || ''
    };
  }

  parseDicomDate(dicomDate) {
    if (!dicomDate || dicomDate.length !== 8) return null;
    const year = dicomDate.substring(0, 4);
    const month = dicomDate.substring(4, 6);
    const day = dicomDate.substring(6, 8);
    return `${year}-${month}-${day}`;
  }

  calculateAge(birthDate, studyDate) {
    if (!birthDate || birthDate.length !== 8) return null;

    const birthYear = parseInt(birthDate.substring(0, 4));
    const birthMonth = parseInt(birthDate.substring(4, 6)) - 1; // 0-indexed
    const birthDay = parseInt(birthDate.substring(6, 8));

    let refYear, refMonth, refDay;
    
    if (studyDate && studyDate.length === 8) {
      refYear = parseInt(studyDate.substring(0, 4));
      refMonth = parseInt(studyDate.substring(4, 6)) - 1; // 0-indexed
      refDay = parseInt(studyDate.substring(6, 8));
    } else {
      const today = new Date();
      refYear = today.getFullYear();
      refMonth = today.getMonth(); // 0-indexed
      refDay = today.getDate();
    }

    const birthDateObj = new Date(birthYear, birthMonth, birthDay);
    const refDateObj = new Date(refYear, refMonth, refDay);

    if (refDateObj < birthDateObj) {
      return null; // Study date cannot be before birth date
    }

    let ageYears = refYear - birthYear;
    if (refMonth < birthMonth || (refMonth === birthMonth && refDay < birthDay)) {
      ageYears--;
    }

    if (ageYears < 2) { // For patients under 2 years old, show age in months
      let ageMonths = (refYear - birthYear) * 12 + (refMonth - birthMonth);
      if (refDay < birthDay) {
        ageMonths--;
      }
      // Ensure age in months is not negative
      return ageMonths >= 0 ? `${ageMonths}M` : null; // Shortened for table
    }

    return `${ageYears}A`; // Shortened for table
  }
}

module.exports = OrthancService;