import { Document, Page, Text, View, StyleSheet, pdf, Font } from '@react-pdf/renderer';

// Register fonts if needed (for Arabic support)
// Font.register({ family: 'Arial', src: '/fonts/Arial.ttf' });

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: 'Helvetica',
  },
  dateRight: {
    textAlign: 'right',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  header: {
    marginBottom: 20,
    borderBottom: '1pt solid #CCCCCC',
    paddingBottom: 10,
  },
  headerText: {
    fontSize: 10,
    textAlign: 'center',
    marginBottom: 2,
  },
  footerText: {
    fontSize: 9,
    textAlign: 'center',
    color: '#666666',
  },
  tableHeader: {
    backgroundColor: '#E8E8E8',
    padding: 8,
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 12,
    border: '1pt solid black',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1pt solid black',
    borderLeft: '1pt solid black',
    borderRight: '1pt solid black',
  },
  tableCell: {
    flex: 1,
    padding: 6,
    fontSize: 11,
  },
  titleBox: {
    backgroundColor: '#F0F0F0',
    border: '2pt solid black',
    padding: 15,
    textAlign: 'center',
    marginTop: 15,
    marginBottom: 20,
  },
  titleMain: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  titleSub: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    fontStyle: 'italic',
    marginTop: 15,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 11,
    marginBottom: 6,
    lineHeight: 1.4,
  },
  conclusionBox: {
    border: '2pt solid black',
    backgroundColor: '#F8F8F8',
    padding: 15,
    marginTop: 20,
    marginBottom: 30,
  },
  conclusionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  conclusionText: {
    fontSize: 11,
    fontWeight: 'bold',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    borderTop: '1pt solid #CCCCCC',
    paddingTop: 8,
    textAlign: 'center',
    fontSize: 9,
    color: '#666666',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    display: 'flex',
  },
  pageNumber: {
    position: 'absolute',
    bottom: 5,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 8,
    color: '#999999',
  }
});

/**
 * Generate PDF document component
 */
const ReportPDF = ({ reportData, settings = {} }) => {
  const {
    patientName,
    patientId,
    patientAge,
    studyDescription,
    studyDate,
    modality,
    findings,
    conclusion,
    technique
  } = reportData;

  // Parse patient name - handle both ^ and space separators
  let lastName = 'N/A';
  let firstName = 'N/A';

  if (patientName) {
    if (patientName.includes('^')) {
      // DICOM format: LAST^FIRST
      const nameParts = patientName.split('^');
      lastName = nameParts[0]?.trim() || 'N/A';
      firstName = nameParts[1]?.trim() || 'N/A';
    } else {
      // Space-separated format: assume "FIRST LAST" or "LAST FIRST"
      const nameParts = patientName.trim().split(/\s+/);
      if (nameParts.length >= 2) {
        firstName = nameParts[0];
        lastName = nameParts.slice(1).join(' ');
      } else {
        lastName = nameParts[0] || 'N/A';
      }
    }
  }

  // Format date
  const reportDate = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  // Parse HTML to structured paragraphs with alignment
  const parseHtmlToStructuredContent = (html) => {
    if (!html || !html.trim()) return [];

    const paragraphs = [];

    if (typeof document !== 'undefined') {
      const temp = document.createElement('div');
      temp.innerHTML = html || '';

      const getAlignment = (element) => {
        const textAlign = element.style.textAlign || element.getAttribute('data-text-align');
        return textAlign || 'left';
      };

      const children = Array.from(temp.children);

      if (children.length === 0) {
        // Plain text - use textContent to strip all HTML tags
        const text = temp.textContent || '';
        if (text.trim()) {
          paragraphs.push({ text: text.trim(), alignment: 'left', isList: false });
        }
      } else {
        children.forEach(child => {
          const tagName = child.tagName.toLowerCase();
          // Use textContent to get pure text without HTML tags
          const text = child.textContent?.trim() || '';
          const alignment = getAlignment(child);

          if (!text) return;

          if (tagName === 'ul') {
            // Bullet list
            const items = Array.from(child.getElementsByTagName('li'));
            items.forEach(li => {
              const liText = li.textContent?.trim() || '';
              if (liText) {
                paragraphs.push({ text: `• ${liText}`, alignment: 'left', isList: true });
              }
            });
          } else if (tagName === 'ol') {
            // Numbered list
            const items = Array.from(child.getElementsByTagName('li'));
            items.forEach((li, index) => {
              const liText = li.textContent?.trim() || '';
              if (liText) {
                paragraphs.push({ text: `${index + 1}. ${liText}`, alignment: 'left', isList: true });
              }
            });
          } else {
            // For all other tags, use textContent to strip HTML
            paragraphs.push({ text, alignment, isList: false });
          }
        });
      }
    } else {
      // Server-side fallback
      const cleanText = (html || '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<li>/gi, '• ')
        .replace(/<\/li>/gi, '\n')
        .replace(/<[^>]*>/g, '');

      const lines = cleanText.split('\n').filter(line => line.trim());
      lines.forEach(line => {
        paragraphs.push({ text: line.trim(), alignment: 'left', isList: false });
      });
    }

    return paragraphs;
  };

  const findingsParagraphs = parseHtmlToStructuredContent(findings);
  const techniqueParagraphs = technique ? parseHtmlToStructuredContent(technique) : [];
  const conclusionParagraphs = conclusion ? parseHtmlToStructuredContent(conclusion) : [];

  const conclusionText = conclusionParagraphs.length > 0
    ? conclusionParagraphs
    : [{ text: "", alignment: 'center', isList: false }];

  const {
    hospitalName = "l'EPH MAZOUNA",
    footerText = "Cité Bousrour en face les pompiers Mazouna Relizane   Tel 0779 00 46 56   حي بوسرور مقابل الحماية المدنية مازونة غليزان",
    headerContent,
    footerContent
  } = settings;

  const headerParagraphs = headerContent ? parseHtmlToStructuredContent(headerContent) : [];
  const footerParagraphs = footerContent ? parseHtmlToStructuredContent(footerContent) : [];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          {headerParagraphs.length > 0 ? (
            headerParagraphs.map((para, i) => (
              <Text key={i} style={{ ...styles.headerText, textAlign: para.alignment }}>{para.text}</Text>
            ))
          ) : (
            <Text style={styles.titleSub}>
              Examen réalisé au niveau de {hospitalName}
            </Text>
          )}
        </View>

        {/* Date */}
        <Text style={styles.dateRight}>{reportDate}</Text>

        {/* Technique Section */}
        {techniqueParagraphs.length > 0 && (
          <View style={{ marginBottom: 15 }}>
            <Text style={styles.sectionTitle}>Technique d'examen :</Text>
            {techniqueParagraphs.map((para, index) => (
              <Text
                key={index}
                style={{
                  ...styles.paragraph,
                  textAlign: para.alignment,
                  marginLeft: para.isList ? 20 : 0
                }}
              >
                {para.text}
              </Text>
            ))}
          </View>
        )}

        {/* Results/Findings Section */}
        <View style={{ marginBottom: 15 }}>
          <Text style={styles.sectionTitle}>Résultat :</Text>
          {findingsParagraphs.length > 0 ? (
            findingsParagraphs.map((para, index) => (
              <Text
                key={index}
                style={{
                  ...styles.paragraph,
                  textAlign: para.alignment,
                  marginLeft: para.isList ? 20 : 0
                }}
              >
                {para.text}
              </Text>
            ))
          ) : (
            <Text style={styles.paragraph}>[Contenu du rapport]</Text>
          )}
        </View>

        {/* Conclusion */}
        <View style={styles.conclusionBox}>
          <Text style={styles.conclusionTitle}>Conclusion :</Text>
          {conclusionText.map((para, index) => (
            <Text
              key={index}
              style={{
                ...styles.conclusionText,
                textAlign: para.alignment || 'center'
              }}
            >
              {para.text}
            </Text>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          {footerParagraphs.length > 0 ? (
            footerParagraphs.map((para, i) => (
              <Text key={i} style={{ ...styles.footerText, textAlign: para.alignment }}>{para.text}</Text>
            ))
          ) : (
            <Text style={styles.footerText}>{footerText}</Text>
          )}
          <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (
            `${pageNumber} / ${totalPages}`
          )} />
        </View>
      </Page>
    </Document>
  );
};

/**
 * Generate and download PDF report
 */
export const downloadPDFReport = async (reportData, settings = {}) => {
  const blob = await pdf(<ReportPDF reportData={reportData} settings={settings} />).toBlob();

  const nameParts = reportData.patientName?.split('^') || ['', ''];
  const lastName = nameParts[0] || 'Report';
  const firstName = nameParts[1] || '';

  const filename = `${lastName}_${firstName}_${reportData.studyDescription || 'Report'}_${new Date().toISOString().split('T')[0]}.pdf`;

  // Create download link
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const exportToPDF = async (
  reportContent,
  patientName,
  patientID,
  studyDescription,
  studyDate,
  hospitalName,
  footerText
) => {
  // Parse sections from combined content
  const parser = typeof document !== 'undefined' ? new DOMParser() : null;
  let techniqueContent = '';
  let findingsContent = reportContent;
  let conclusionContent = '';

  if (parser) {
    const doc = parser.parseFromString(reportContent, 'text/html');
    const techniqueDiv = doc.querySelector('.technique');
    const findingsDiv = doc.querySelector('.findings');
    const conclusionDiv = doc.querySelector('.conclusion');

    techniqueContent = techniqueDiv ? techniqueDiv.innerHTML : '';
    findingsContent = findingsDiv ? findingsDiv.innerHTML : reportContent;
    conclusionContent = conclusionDiv ? conclusionDiv.innerHTML : '';
  }

  const reportData = {
    patientName,
    patientId: patientID,
    patientAge: null,
    studyDescription,
    studyDate,
    modality: '',
    technique: techniqueContent,
    findings: findingsContent,
    conclusion: conclusionContent
  };

  const settings = {
    hospitalName,
    footerText
  };

  return downloadPDFReport(reportData, settings);
};

/**
 * Generate PDF from report and clinic data (for dashboard downloads)
 */
export const generatePDF = async (report, clinic) => {
  // Parse sections from combined content
  let techniqueContent = '';
  let findingsContent = '';
  let conclusionContent = '';

  if (typeof document !== 'undefined' && report.content) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(report.content, 'text/html');

    const techniqueDiv = doc.querySelector('.technique');
    const findingsDiv = doc.querySelector('.findings');
    const conclusionDiv = doc.querySelector('.conclusion');

    techniqueContent = techniqueDiv ? techniqueDiv.innerHTML : '';
    findingsContent = findingsDiv ? findingsDiv.innerHTML : report.content;
    conclusionContent = conclusionDiv ? conclusionDiv.innerHTML : report.conclusion || '';
  } else {
    // Fallback if document is not available
    findingsContent = report.content || '';
    conclusionContent = report.conclusion || '';
  }

  const reportData = {
    patientName: report.patientName,
    patientId: report.patientId,
    patientAge: null,
    studyDescription: report.studyDescription,
    studyDate: report.studyDate,
    modality: report.modality,
    technique: techniqueContent,
    findings: findingsContent,
    conclusion: conclusionContent
  };

  const settings = {
    hospitalName: clinic?.name || "Cabinet D'imagerie Médicale",
    footerText: clinic?.address || "Cité Bousrour en face les pompiers Mazouna Relizane   Tel 0779 00 46 56",
    headerContent: clinic?.headerContent,
    footerContent: clinic?.footerContent
  };

  return downloadPDFReport(reportData, settings);
};


