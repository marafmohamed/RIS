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
      const url = `${this.baseUrl}${endpoint}`;
      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': this.authHeader,
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      if (!response.ok) {
        throw new Error(`Orthanc API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Orthanc request error:', error);
      throw error;
    }
  }

  // --- UPDATED FIND STUDIES ---
  async findStudies(query = {}) {
    const searchQuery = {
      Level: 'Study',
      Expand: true,
      Query: { ...query }
    };

    // 1. Get the list of studies
    const studies = await this.makeRequest('/tools/find', {
      method: 'POST',
      body: JSON.stringify(searchQuery)
    });

    // 2. "Hydrate" missing data (Modality)
    // Since ModalitiesInStudy is missing, we fetch the first Series to get the Modality.
    const hydratedStudies = await Promise.all(studies.map(async (study) => {
      // Check if we need to fetch modality
      const hasModality = study.ModalitiesInStudy || (study.MainDicomTags && study.MainDicomTags.Modality);
      
      if (!hasModality && study.Series && study.Series.length > 0) {
        try {
          // Fetch the details of the FIRST series in the study
          const firstSeriesId = study.Series[0];
          const seriesData = await this.makeRequest(`/series/${firstSeriesId}`);
          
          // Inject the found modality into the study object's tags so parseStudy can find it
          if (seriesData.MainDicomTags && seriesData.MainDicomTags.Modality) {
            study.MainDicomTags = study.MainDicomTags || {};
            study.MainDicomTags.Modality = seriesData.MainDicomTags.Modality;
          }
        } catch (err) {
          console.warn(`Could not fetch series for study ${study.ID} to determine modality.`);
        }
      }
      return study;
    }));

    return hydratedStudies;
  }

  async getStudyDetails(studyId) {
    return await this.makeRequest(`/studies/${studyId}`);
  }

  async getStudyInstances(studyId) {
    return await this.makeRequest(`/studies/${studyId}/instances`);
  }

  async getSystemInfo() {
    return await this.makeRequest('/system');
  }

  async searchStudiesByDate(startDate, endDate) {
    const dateQuery = {};
    if (startDate && endDate) {
      const start = startDate.replace(/-/g, '');
      const end = endDate.replace(/-/g, '');
      dateQuery.StudyDate = `${start}-${end}`;
    } else if (startDate) {
      const start = startDate.replace(/-/g, '');
      dateQuery.StudyDate = `${start}-`;
    }
    return await this.findStudies(dateQuery);
  }

  async searchStudiesByPatientName(patientName) {
    // Use case-insensitive wildcard search
    // DICOM standard uses * as wildcard, searches are typically case-insensitive
    return await this.findStudies({
      PatientName: `*${patientName}*`
    });
  }

  async searchStudiesByPatientID(patientId) {
    // Use wildcard for partial matches
    return await this.findStudies({
      PatientID: `*${patientId}*`
    });
  }

  // --- UPDATED PARSER ---
  parseStudy(orthancStudy) {
    const mainDicomTags = orthancStudy.MainDicomTags || {};
    const patientMainDicomTags = orthancStudy.PatientMainDicomTags || {};

    // 1. Extract Modality (Now populated by findStudies if missing)
    let modality = orthancStudy.ModalitiesInStudy || mainDicomTags.ModalitiesInStudy || mainDicomTags.Modality || [];
    
    if (Array.isArray(modality)) {
      modality = modality.join('/');
    }

    // 2. Extract/Calculate Age
    let age = patientMainDicomTags.PatientAge || mainDicomTags.PatientAge;
    
    // Only calculate if age tag is missing AND we have a BirthDate
    if ((!age || age === '000') && patientMainDicomTags.PatientBirthDate) {
        age = this.calculateAge(patientMainDicomTags.PatientBirthDate, mainDicomTags.StudyDate);
    }

    // Handle empty age specifically
    if (!age) {
        age = ''; // Return empty string instead of null/undefined to be safe for frontend
    }

    return {
      studyInstanceUid: mainDicomTags.StudyInstanceUID || '',
      orthancId: orthancStudy.ID || '',
      patientName: (patientMainDicomTags.PatientName || 'Unknown').replace(/\^/g, ' ').trim(),
      patientId: patientMainDicomTags.PatientID || '',
      patientBirthDate: patientMainDicomTags.PatientBirthDate || '',
      patientAge: age,
      studyDate: this.parseDicomDate(mainDicomTags.StudyDate),
      studyTime: mainDicomTags.StudyTime || '',
      studyDescription: mainDicomTags.StudyDescription || '',
      modality: modality || 'Unknown', 
      accessionNumber: mainDicomTags.AccessionNumber || '',
      numberOfSeries: orthancStudy.Series ? orthancStudy.Series.length : 0,
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
      return ageMonths >= 0 ? `${ageMonths}Mois` : null;
    }

    return ageYears >= 0 ? `${ageYears}Ans` : null;
  }
}

module.exports = OrthancService;