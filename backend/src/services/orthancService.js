const fetch = require('node-fetch');

class OrthancService {
  constructor() {
    this.baseUrl = process.env.ORTHANC_URL;
    this.username = process.env.ORTHANC_USERNAME;
    this.password = process.env.ORTHANC_PASSWORD;
    this.authHeader = 'Basic ' + Buffer.from(`${this.username}:${this.password}`).toString('base64');
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

  async findStudies(query = {}) {
    const searchQuery = {
      Level: 'Study',
      Expand: true,
      Query: {
        ...query
      }
    };

    const studies = await this.makeRequest('/tools/find', {
      method: 'POST',
      body: JSON.stringify(searchQuery)
    });

    return studies;
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
      // DICOM date format: YYYYMMDD
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
    return await this.findStudies({
      PatientName: `*${patientName}*`
    });
  }

  async searchStudiesByPatientID(patientId) {
    return await this.findStudies({
      PatientID: patientId
    });
  }

  parseStudy(orthancStudy) {
    const mainDicomTags = orthancStudy.MainDicomTags || {};
    const patientMainDicomTags = orthancStudy.PatientMainDicomTags || {};

    return {
      studyInstanceUid: mainDicomTags.StudyInstanceUID || '',
      orthancId: orthancStudy.ID || '',
      patientName: patientMainDicomTags.PatientName || 'Unknown',
      patientId: patientMainDicomTags.PatientID || '',
      patientBirthDate: patientMainDicomTags.PatientBirthDate || '',
      patientAge: this.calculateAge(patientMainDicomTags.PatientBirthDate, mainDicomTags.StudyDate),
      studyDate: this.parseDicomDate(mainDicomTags.StudyDate),
      studyTime: mainDicomTags.StudyTime || '',
      studyDescription: mainDicomTags.StudyDescription || '',
      modality: mainDicomTags.ModalitiesInStudy || mainDicomTags.Modality || '',
      accessionNumber: mainDicomTags.AccessionNumber || '',
      numberOfSeries: orthancStudy.Series?.length || 0,
      institutionName: mainDicomTags.InstitutionName || ''
    };
  }

  parseDicomDate(dicomDate) {
    if (!dicomDate) return null;
    
    // DICOM date format: YYYYMMDD
    const year = dicomDate.substring(0, 4);
    const month = dicomDate.substring(4, 6);
    const day = dicomDate.substring(6, 8);
    
    return `${year}-${month}-${day}`;
  }

  calculateAge(birthDate, studyDate) {
    if (!birthDate) return null;
    
    // Parse birth date (YYYYMMDD)
    const birthYear = parseInt(birthDate.substring(0, 4));
    const birthMonth = parseInt(birthDate.substring(4, 6));
    const birthDay = parseInt(birthDate.substring(6, 8));
    
    // Use study date if available, otherwise use today
    let refYear, refMonth, refDay;
    if (studyDate) {
      refYear = parseInt(studyDate.substring(0, 4));
      refMonth = parseInt(studyDate.substring(4, 6));
      refDay = parseInt(studyDate.substring(6, 8));
    } else {
      const today = new Date();
      refYear = today.getFullYear();
      refMonth = today.getMonth() + 1;
      refDay = today.getDate();
    }
    
    // Calculate age
    let age = refYear - birthYear;
    
    // Adjust if birthday hasn't occurred yet this year
    if (refMonth < birthMonth || (refMonth === birthMonth && refDay < birthDay)) {
      age--;
    }
    
    return age > 0 ? age : null;
  }
}

module.exports = new OrthancService();
