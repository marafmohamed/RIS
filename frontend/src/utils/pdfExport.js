import { format } from 'date-fns';

// Helper: Convert WebP (or others) to PNG for PDF compatibility
const convertImageToPNG = (src) => {
  return new Promise((resolve) => {
    // If it's already a format React-PDF likes (png/jpg) and not webp, return it
    if (!src.includes('data:image/webp')) {
      resolve(src);
      return;
    }

    if (typeof document === 'undefined') {
      resolve(src);
      return;
    }

    const img = new window.Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const pngData = canvas.toDataURL('image/png');
      resolve(pngData);
    };
    img.onerror = () => {
      resolve(src); // Fallback to original
    };
    img.src = src;
  });
};

// Helper: Parse HTML string to structured objects
const parseHtmlToStructuredContent = (html) => {
  if (!html || !html.trim()) return [];

  const items = [];

  if (typeof document !== 'undefined') {
    const temp = document.createElement('div');
    temp.innerHTML = html || '';

    const getAlignment = (element) => {
      return element.style.textAlign || 
             element.getAttribute('align') || 
             element.getAttribute('data-text-align') || 
             'left';
    };

    // Improved Font Size Detection (Inline Styles OR Tag Defaults)
    const getFontSize = (element) => {
      if (element.style.fontSize) {
        const size = parseFloat(element.style.fontSize);
        if (!isNaN(size)) return size; 
      }
      
      const tag = element.tagName.toLowerCase();
      switch(tag) {
        case 'h1': return 24;
        case 'h2': return 20;
        case 'h3': return 16;
        case 'h4': return 14;
        default: return null;
      }
    };

    // Detect Bold Weight
    const getFontWeight = (element) => {
      if (element.style.fontWeight === 'bold' || parseInt(element.style.fontWeight) >= 600) return 'bold';
      const tag = element.tagName.toLowerCase();
      if (['b', 'strong', 'h1', 'h2', 'h3', 'h4'].includes(tag)) return 'bold';
      return 'normal';
    };

    const processNode = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.trim();
        if (text) {
          const parent = node.parentNode;
          const parentAlignment = parent ? getAlignment(parent) : 'left';
          const parentFontSize = parent ? getFontSize(parent) : null;
          const parentFontWeight = parent ? getFontWeight(parent) : 'normal';
          
          items.push({ 
            type: 'text', 
            text, 
            alignment: parentAlignment, 
            fontSize: parentFontSize,
            fontWeight: parentFontWeight
          });
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName.toLowerCase();

        if (tagName === 'img') {
          const src = node.getAttribute('src');
          if (src) {
            items.push({ type: 'image', src, alignment: getAlignment(node) });
          }
        } else if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'li'].includes(tagName)) {
          const alignment = getAlignment(node);
          const fontSize = getFontSize(node);
          const fontWeight = getFontWeight(node);
          
          const imgs = node.getElementsByTagName('img');
          if (imgs.length > 0) {
            Array.from(node.childNodes).forEach(child => processNode(child));
          } else {
            const text = node.textContent?.trim();
            if (text) {
              items.push({ 
                type: 'text', 
                text: tagName === 'li' ? `• ${text}` : text, 
                alignment: alignment,
                fontSize: fontSize,
                fontWeight: fontWeight
              });
            }
          }
        } else {
          Array.from(node.childNodes).forEach(processNode);
        }
      }
    };

    Array.from(temp.childNodes).forEach(processNode);
  }
  return items;
};

const processContentImages = async (items) => {
  const processed = await Promise.all(items.map(async (item) => {
    if (item.type === 'image') {
      const newSrc = await convertImageToPNG(item.src);
      return { ...item, src: newSrc };
    }
    return item;
  }));
  return processed;
};

export const downloadPDFReport = async (reportData, settings = {}, clinicData = null, patientAgeArg = null) => {
  const ReactPDF = await import('@react-pdf/renderer');
  const { Document, Page, Text, View, StyleSheet, pdf, Font, Image } = ReactPDF;

  Font.register({
    family: 'Amiri',
    fonts: [
      { src: 'https://raw.githubusercontent.com/google/fonts/main/ofl/amiri/Amiri-Regular.ttf' },
      { src: 'https://raw.githubusercontent.com/google/fonts/main/ofl/amiri/Amiri-Bold.ttf', fontWeight: 'bold' }
    ]
  });

  const styles = StyleSheet.create({
    page: {
      padding: 40,
      fontSize: 11,
      fontFamily: 'Amiri',
      paddingBottom: 60,
    },
    dateRight: {
      textAlign: 'right',
      fontSize: 12,
      fontWeight: 'bold',
      marginBottom: 15,
    },
    header: {
      marginBottom: 20,
      borderBottomWidth: 1,
      borderBottomColor: '#CCCCCC',
      borderBottomStyle: 'solid',
      paddingBottom: 10,
      flexDirection: 'column',
      justifyContent: 'center', 
      minHeight: 60,
    },
    headerImage: {
      height: 60,
      objectFit: 'contain',
      marginBottom: 5,
      // No default alignment here, handled dynamically
    },
    headerText: {
      fontSize: 14, // Fallback default size
      marginBottom: 2,
    },
    footerText: {
      fontSize: 9,
      color: '#666666',
    },
    patientTable: {
      display: 'table',
      width: '100%',
      borderStyle: 'solid',
      borderWidth: 1,
      borderColor: '#000',
      marginBottom: 20,
    },
    patientTableRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: '#000',
      alignItems: 'center',
    },
    patientTableHeader: {
      backgroundColor: '#f0f0f0',
      padding: 5,
      textAlign: 'center',
      fontWeight: 'bold',
      width: '100%',
    },
    patientTableCell: {
      padding: 8,
      fontSize: 11,
      borderRightWidth: 1,
      borderRightColor: '#000',
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: 'bold',
      textDecoration: 'underline',
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
    },
    footer: {
      position: 'absolute',
      bottom: 20,
      left: 40,
      right: 40,
      borderTop: '1pt solid #CCCCCC',
      paddingTop: 8,
      textAlign: 'center',
      fontSize: 9,
      color: '#666666',
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

  const {
    patientName,
    patientId,
    studyDescription,
    studyDate,
    findings,
    conclusion,
    technique
  } = reportData;

  // Use passed argument first, fallback to report data, fallback to N/A
  const displayAge = patientAgeArg || reportData.patientAge || 'N/A';

  const findingsItems = await processContentImages(parseHtmlToStructuredContent(findings));
  const techniqueItems = technique ? await processContentImages(parseHtmlToStructuredContent(technique)) : [];
  const conclusionItems = conclusion ? await processContentImages(parseHtmlToStructuredContent(conclusion)) : [];
  const headerItems = settings.headerContent ? await processContentImages(parseHtmlToStructuredContent(settings.headerContent)) : [];
  const footerItems = settings.footerContent ? await processContentImages(parseHtmlToStructuredContent(settings.footerContent)) : [];

  let lastName = 'N/A';
  let firstName = 'N/A';
  if (patientName) {
    if (patientName.includes('^')) {
      const nameParts = patientName.split('^');
      lastName = nameParts[0]?.trim() || 'N/A';
      firstName = nameParts[1]?.trim() || 'N/A';
    } else {
      const nameParts = patientName.trim().split(/\s+/);
      if (nameParts.length >= 2) {
        firstName = nameParts[0];
        lastName = nameParts.slice(1).join(' ');
      } else {
        lastName = nameParts[0] || 'N/A';
      }
    }
  }

  const reportDateFormatted = studyDate 
    ? new Date(studyDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : new Date().toLocaleDateString('fr-FR');

  const ReportPDF = () => (
    <Document>
      <Page size="A4" style={styles.page}>
        
        {/* Header Section */}
        <View style={styles.header}>
          {headerItems.length > 0 ? (
            headerItems.map((item, i) => {
              if (item.type === 'image') {
                return (
                  <Image 
                    key={i} 
                    src={item.src} 
                    style={{
                      ...styles.headerImage,
                      // STRICT ALIGNMENT: Uses flex-start (left), center, or flex-end (right)
                      alignSelf: item.alignment === 'center' ? 'center' : (item.alignment === 'right' ? 'flex-end' : 'flex-start')
                    }} 
                  />
                );
              }
              
              // Font Size Logic: Use parsed size, or default to 14 (Big)
              const fontSize = item.fontSize || 14;
              const fontWeight = item.fontWeight || 'normal';

              return (
                <Text key={i} style={{ 
                  marginBottom: 2,
                  textAlign: item.alignment || 'left',
                  fontSize: fontSize,
                  fontWeight: fontWeight
                }}>
                  {item.text}
                </Text>
              );
            })
          ) : (
            <View>
              <Text style={{ fontSize: 18, fontWeight: 'bold', textAlign: 'center' }}>{settings.hospitalName}</Text>
            </View>
          )}
        </View>

        <Text style={styles.dateRight}>Le: {reportDateFormatted}</Text>

        <View style={styles.patientTable}>
          <View style={{...styles.patientTableRow, backgroundColor: '#f0f0f0'}}>
            <Text style={styles.patientTableHeader}>IDENTIFICATION DU PATIENT</Text>
          </View>
          <View style={{...styles.patientTableRow, borderBottomWidth: 0}}>
            <View style={{ ...styles.patientTableCell, width: '45%' }}>
              <Text>Nom: <Text style={{ fontWeight: 'bold' }}>{lastName} {firstName}</Text></Text>
            </View>
            <View style={{ ...styles.patientTableCell, width: '30%' }}>
              <Text>Age: <Text style={{ fontWeight: 'bold' }}>{displayAge}</Text></Text>
            </View>
            <View style={{ ...styles.patientTableCell, width: '25%', borderRightWidth: 0 }}>
              <Text>ID: {patientId}</Text>
            </View>
          </View>
        </View>

        <Text style={{ textAlign: 'center', fontSize: 16, fontWeight: 'bold', marginBottom: 20, textDecoration: 'underline' }}>
           COMPTE RENDU {studyDescription ? `DE ${studyDescription.toUpperCase()}` : ''}
        </Text>

        {techniqueItems.length > 0 && (
          <View style={{ marginBottom: 15 }}>
            <Text style={styles.sectionTitle}>Technique d&apos;examen :</Text>
            {techniqueItems.map((item, index) => {
              if (item.type === 'image') {
                return <Image key={index} src={item.src} style={{ height: 150, objectFit: 'contain', marginBottom: 10, alignSelf: item.alignment === 'center' ? 'center' : 'flex-start' }} />;
              }
              return <Text key={index} style={{ ...styles.paragraph, textAlign: item.alignment || 'left' }}>{item.text}</Text>;
            })}
          </View>
        )}

        <View style={{ marginBottom: 15 }}>
          <Text style={styles.sectionTitle}>Résultat :</Text>
          {findingsItems.length > 0 ? (
            findingsItems.map((item, index) => {
              if (item.type === 'image') {
                 return <Image key={index} src={item.src} style={{ height: 150, objectFit: 'contain', marginBottom: 10, alignSelf: item.alignment === 'center' ? 'center' : 'flex-start' }} />;
              }
              return <Text key={index} style={{ ...styles.paragraph, textAlign: item.alignment || 'left' }}>{item.text}</Text>;
            })
          ) : <Text style={styles.paragraph}>...</Text>}
        </View>

        {conclusionItems.length > 0 && (
          <View style={styles.conclusionBox}>
            <Text style={styles.conclusionTitle}>Conclusion :</Text>
            {conclusionItems.map((item, index) => (
              <Text key={index} style={{ ...styles.conclusionText, textAlign: item.alignment || 'center' }}>
                {item.text}
              </Text>
            ))}
          </View>
        )}

        <View style={styles.footer} fixed>
          {footerItems.length > 0 ? (
            footerItems.map((item, i) => (
              <Text key={i} style={{ ...styles.footerText, textAlign: item.alignment || 'center' }}>{item.text}</Text>
            ))
          ) : (
            <Text style={styles.footerText}>{settings.footerText}</Text>
          )}
          <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (
            `${pageNumber} / ${totalPages}`
          )} />
        </View>
      </Page>
    </Document>
  );

  try {
    const blob = await pdf(<ReportPDF />).toBlob();
    const nameParts = patientName?.split('^') || ['', ''];
    const filename = `${nameParts[0]}_${nameParts[1]}_Report.pdf`;
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("PDF Generation failed:", err);
    throw err;
  }
};

export const exportToPDF = async (
  reportContent,
  patientName,
  patientID,
  studyDescription,
  studyDate,
  hospitalName,
  footerText,
  clinicData = null,
  patientAge = null
) => {
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
    patientAge,
    studyDescription,
    studyDate,
    technique: techniqueContent,
    findings: findingsContent,
    conclusion: conclusionContent
  };

  const settings = {
    hospitalName,
    footerText,
    headerContent: clinicData?.headerContent,
    footerContent: clinicData?.footerContent
  };

  return downloadPDFReport(reportData, settings, clinicData, patientAge);
};

export const generatePDF = async (report, clinic, patientAge) => {
  return exportToPDF(
    report.content,
    report.patientName,
    report.patientId,
    report.studyDescription,
    report.studyDate,
    clinic?.name,
    clinic?.address,
    clinic,
    patientAge || report.patientAge // Check passed age, then report age
  );
};