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

// Helper: Parse HTML string to structured objects with TABLE and HR support
const parseHtmlToStructuredContent = (html) => {
  if (!html || !html.trim()) return [];

  const items = [];

  if (typeof document !== 'undefined') {
    const temp = document.createElement('div');
    temp.innerHTML = html || '';

    const getAlignment = (element) => {
      return element.style.textAlign || 
             element.getAttribute('align') || 
             'left';
    };

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

    const getFontWeight = (element) => {
      if (element.style.fontWeight === 'bold' || parseInt(element.style.fontWeight) >= 600) return 'bold';
      const tag = element.tagName.toLowerCase();
      if (['b', 'strong', 'h1', 'h2', 'h3', 'h4'].includes(tag)) return 'bold';
      return 'normal';
    };

    const getColor = (element) => {
      const color = element.style.color;
      if (color && color.startsWith('#')) return color;
      if (color && color.startsWith('rgb')) {
        // Convert rgb to hex
        const match = color.match(/\d+/g);
        if (match && match.length >= 3) {
          const r = parseInt(match[0]).toString(16).padStart(2, '0');
          const g = parseInt(match[1]).toString(16).padStart(2, '0');
          const b = parseInt(match[2]).toString(16).padStart(2, '0');
          return `#${r}${g}${b}`;
        }
      }
      return null;
    };

    const processNode = (node, insideTable = false) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.trim();
        if (text) {
          const parent = node.parentNode;
          items.push({ 
            type: 'text', 
            text, 
            alignment: parent ? getAlignment(parent) : 'left',
            fontSize: parent ? getFontSize(parent) : null,
            fontWeight: parent ? getFontWeight(parent) : 'normal',
            color: parent ? getColor(parent) : null
          });
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName.toLowerCase();

        // HR - Horizontal line with color
        if (tagName === 'hr') {
          let color = '#3b82f6'; // Default blue
          const borderStyle = node.style.borderTop || node.style.border || '';
          if (borderStyle.includes('#')) {
            const match = borderStyle.match(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})/);
            if (match) color = match[0];
          }
          items.push({ type: 'hr', color });
          return;
        }

        // TABLE - Side-by-side layout
        if (tagName === 'table') {
          const rows = [];
          const trs = Array.from(node.querySelectorAll('tr'));
          
          trs.forEach(tr => {
            const cells = [];
            const tds = Array.from(tr.querySelectorAll('td, th'));
            
            tds.forEach(td => {
              const cellContent = [];
              const cellAlignment = getAlignment(td);
              const cellVAlign = td.style.verticalAlign || 'top';
              
              // Parse width
              let width = td.style.width || td.getAttribute('width') || 'auto';
              if (width !== 'auto' && !width.includes('%')) {
                width = width.replace(/[^0-9]/g, '');
                width = width ? `${width}%` : 'auto';
              }
              
              // Process cell children
              Array.from(td.childNodes).forEach(child => {
                if (child.nodeType === Node.TEXT_NODE) {
                  const text = child.textContent.trim();
                  if (text) {
                    cellContent.push({
                      type: 'text',
                      text,
                      alignment: cellAlignment,
                      fontSize: getFontSize(td),
                      fontWeight: getFontWeight(td),
                      color: getColor(td)
                    });
                  }
                } else if (child.nodeType === Node.ELEMENT_NODE) {
                  const childTag = child.tagName.toLowerCase();
                  
                  if (childTag === 'img') {
                    const src = child.getAttribute('src');
                    if (src) {
                      const imgWidth = child.getAttribute('width');
                      const imgHeight = child.getAttribute('height');
                      cellContent.push({
                        type: 'image',
                        src,
                        width: imgWidth ? parseInt(imgWidth) : null,
                        height: imgHeight ? parseInt(imgHeight) : null,
                        alignment: getAlignment(child)
                      });
                    }
                  } else if (['h1', 'h2', 'h3', 'h4', 'p', 'div'].includes(childTag)) {
                    const text = child.textContent.trim();
                    if (text) {
                      cellContent.push({
                        type: 'text',
                        text,
                        alignment: getAlignment(child),
                        fontSize: getFontSize(child),
                        fontWeight: getFontWeight(child),
                        color: getColor(child)
                      });
                    }
                  }
                }
              });
              
              cells.push({
                type: 'cell',
                width,
                alignment: cellAlignment,
                verticalAlign: cellVAlign,
                content: cellContent
              });
            });
            
            if (cells.length > 0) {
              rows.push({ type: 'row', cells });
            }
          });
          
          if (rows.length > 0) {
            items.push({ type: 'table', rows });
          }
          return;
        }

        // IMAGE
        if (tagName === 'img') {
          const src = node.getAttribute('src');
          if (src) {
            const imgWidth = node.getAttribute('width');
            const imgHeight = node.getAttribute('height');
            items.push({
              type: 'image',
              src,
              width: imgWidth ? parseInt(imgWidth) : null,
              height: imgHeight ? parseInt(imgHeight) : null,
              alignment: getAlignment(node)
            });
          }
          return;
        }

        // TEXT BLOCKS
        if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'li'].includes(tagName)) {
          const alignment = getAlignment(node);
          const fontSize = getFontSize(node);
          const fontWeight = getFontWeight(node);
          const color = getColor(node);
          
          const imgs = node.getElementsByTagName('img');
          if (imgs.length > 0) {
            Array.from(node.childNodes).forEach(child => processNode(child));
          } else {
            const text = node.textContent?.trim();
            if (text) {
              items.push({ 
                type: 'text', 
                text: tagName === 'li' ? `• ${text}` : text, 
                alignment,
                fontSize,
                fontWeight,
                color
              });
            }
          }
        } else {
          Array.from(node.childNodes).forEach(child => processNode(child));
        }
      }
    };

    Array.from(temp.childNodes).forEach(node => processNode(node));
  }
  return items;
};

const processContentImages = async (items) => {
  const processed = await Promise.all(items.map(async (item) => {
    if (item.type === 'image') {
      const newSrc = await convertImageToPNG(item.src);
      return { ...item, src: newSrc };
    }
    if (item.type === 'table') {
      // Process images inside table cells
      const processedRows = await Promise.all(item.rows.map(async (row) => {
        const processedCells = await Promise.all(row.cells.map(async (cell) => {
          const processedContent = await Promise.all(cell.content.map(async (contentItem) => {
            if (contentItem.type === 'image') {
              const newSrc = await convertImageToPNG(contentItem.src);
              return { ...contentItem, src: newSrc };
            }
            return contentItem;
          }));
          return { ...cell, content: processedContent };
        }));
        return { ...row, cells: processedCells };
      }));
      return { ...item, rows: processedRows };
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
              // TABLE - Side-by-side layout (logo + text)
              if (item.type === 'table') {
                return (
                  <View key={i} style={{ marginBottom: 5 }}>
                    {item.rows.map((row, rowIdx) => (
                      <View key={rowIdx} style={{ flexDirection: 'row', width: '100%' }}>
                        {row.cells.map((cell, cellIdx) => (
                          <View 
                            key={cellIdx} 
                            style={{ 
                              flexBasis: cell.width === 'auto' ? '50%' : cell.width,
                              flexGrow: cell.width === 'auto' ? 1 : 0,
                              padding: 2,
                              justifyContent: cell.verticalAlign === 'middle' ? 'center' : 'flex-start',
                              alignItems: cell.alignment === 'right' ? 'flex-end' : (cell.alignment === 'center' ? 'center' : 'flex-start')
                            }}
                          >
                            {cell.content.map((content, contentIdx) => {
                              if (content.type === 'image') {
                                return (
                                  <Image 
                                    key={contentIdx} 
                                    src={content.src} 
                                    style={{ 
                                      height: content.height || 60, 
                                      width: content.width || undefined,
                                      objectFit: 'contain',
                                      marginBottom: 2
                                    }} 
                                  />
                                );
                              }
                              return (
                                <Text 
                                  key={contentIdx} 
                                  style={{ 
                                    fontSize: content.fontSize || 12,
                                    fontWeight: content.fontWeight || 'normal',
                                    color: content.color || '#000',
                                    marginBottom: 1,
                                    textAlign: content.alignment || cell.alignment || 'left'
                                  }}
                                >
                                  {content.text}
                                </Text>
                              );
                            })}
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                );
              }
              
              // HR - Horizontal line
              if (item.type === 'hr') {
                return (
                  <View 
                    key={i} 
                    style={{ 
                      borderBottomWidth: 3, 
                      borderBottomColor: item.color || '#3b82f6',
                      width: '100%',
                      marginTop: 2,
                      marginBottom: 8
                    }} 
                  />
                );
              }
              
              // IMAGE
              if (item.type === 'image') {
                return (
                  <Image 
                    key={i} 
                    src={item.src} 
                    style={{
                      height: item.height || 60,
                      width: item.width || undefined,
                      objectFit: 'contain',
                      marginBottom: 5,
                      alignSelf: item.alignment === 'center' ? 'center' : (item.alignment === 'right' ? 'flex-end' : 'flex-start')
                    }} 
                  />
                );
              }

              // TEXT
              const fontSize = item.fontSize || 14;
              const fontWeight = item.fontWeight || 'normal';

              return (
                <Text key={i} style={{ 
                  marginBottom: 2,
                  textAlign: item.alignment || 'left',
                  fontSize: fontSize,
                  fontWeight: fontWeight,
                  color: item.color || '#000'
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
              if (item.type === 'table') {
                return (
                  <View key={index} style={{ marginBottom: 10 }}>
                    {item.rows.map((row, rowIdx) => (
                      <View key={rowIdx} style={{ flexDirection: 'row', width: '100%' }}>
                        {row.cells.map((cell, cellIdx) => (
                          <View 
                            key={cellIdx} 
                            style={{ 
                              flexBasis: cell.width === 'auto' ? '50%' : cell.width,
                              flexGrow: cell.width === 'auto' ? 1 : 0,
                              padding: 5,
                              justifyContent: cell.verticalAlign === 'middle' ? 'center' : 'flex-start',
                              alignItems: cell.alignment === 'right' ? 'flex-end' : (cell.alignment === 'center' ? 'center' : 'flex-start')
                            }}
                          >
                            {cell.content.map((content, contentIdx) => {
                              if (content.type === 'image') {
                                return (
                                  <Image 
                                    key={contentIdx} 
                                    src={content.src} 
                                    style={{ 
                                      height: content.height || 100, 
                                      width: content.width || undefined,
                                      objectFit: 'contain',
                                      marginBottom: 5
                                    }} 
                                  />
                                );
                              }
                              return (
                                <Text 
                                  key={contentIdx} 
                                  style={{ 
                                    fontSize: content.fontSize || 11,
                                    fontWeight: content.fontWeight || 'normal',
                                    color: content.color || '#000',
                                    marginBottom: 3,
                                    textAlign: content.alignment || cell.alignment || 'left'
                                  }}
                                >
                                  {content.text}
                                </Text>
                              );
                            })}
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                );
              }
              if (item.type === 'hr') {
                return (
                  <View 
                    key={index} 
                    style={{ 
                      borderBottomWidth: 2, 
                      borderBottomColor: item.color || '#000',
                      marginVertical: 5
                    }} 
                  />
                );
              }
              if (item.type === 'image') {
                return (
                  <Image 
                    key={index} 
                    src={item.src} 
                    style={{ 
                      height: item.height || 150, 
                      width: item.width || undefined,
                      objectFit: 'contain', 
                      marginBottom: 10, 
                      alignSelf: item.alignment === 'center' ? 'center' : (item.alignment === 'right' ? 'flex-end' : 'flex-start')
                    }} 
                  />
                );
              }
              return (
                <Text 
                  key={index} 
                  style={{ 
                    ...styles.paragraph, 
                    textAlign: item.alignment || 'left',
                    fontSize: item.fontSize || 11,
                    fontWeight: item.fontWeight || 'normal',
                    color: item.color || '#000'
                  }}
                >
                  {item.text}
                </Text>
              );
            })}
          </View>
        )}

        <View style={{ marginBottom: 15 }}>
          <Text style={styles.sectionTitle}>Résultat :</Text>
          {findingsItems.length > 0 ? (
            findingsItems.map((item, index) => {
              if (item.type === 'table') {
                return (
                  <View key={index} style={{ marginBottom: 10 }}>
                    {item.rows.map((row, rowIdx) => (
                      <View key={rowIdx} style={{ flexDirection: 'row', width: '100%' }}>
                        {row.cells.map((cell, cellIdx) => (
                          <View 
                            key={cellIdx} 
                            style={{ 
                              flexBasis: cell.width === 'auto' ? '50%' : cell.width,
                              flexGrow: cell.width === 'auto' ? 1 : 0,
                              padding: 5,
                              justifyContent: cell.verticalAlign === 'middle' ? 'center' : 'flex-start',
                              alignItems: cell.alignment === 'right' ? 'flex-end' : (cell.alignment === 'center' ? 'center' : 'flex-start')
                            }}
                          >
                            {cell.content.map((content, contentIdx) => {
                              if (content.type === 'image') {
                                return (
                                  <Image 
                                    key={contentIdx} 
                                    src={content.src} 
                                    style={{ 
                                      height: content.height || 100, 
                                      width: content.width || undefined,
                                      objectFit: 'contain',
                                      marginBottom: 5
                                    }} 
                                  />
                                );
                              }
                              return (
                                <Text 
                                  key={contentIdx} 
                                  style={{ 
                                    fontSize: content.fontSize || 11,
                                    fontWeight: content.fontWeight || 'normal',
                                    color: content.color || '#000',
                                    marginBottom: 3,
                                    textAlign: content.alignment || cell.alignment || 'left'
                                  }}
                                >
                                  {content.text}
                                </Text>
                              );
                            })}
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                );
              }
              if (item.type === 'hr') {
                return (
                  <View 
                    key={index} 
                    style={{ 
                      borderBottomWidth: 2, 
                      borderBottomColor: item.color || '#000',
                      marginVertical: 5
                    }} 
                  />
                );
              }
              if (item.type === 'image') {
                return (
                  <Image 
                    key={index} 
                    src={item.src} 
                    style={{ 
                      height: item.height || 150, 
                      width: item.width || undefined,
                      objectFit: 'contain', 
                      marginBottom: 10, 
                      alignSelf: item.alignment === 'center' ? 'center' : (item.alignment === 'right' ? 'flex-end' : 'flex-start')
                    }} 
                  />
                );
              }
              return (
                <Text 
                  key={index} 
                  style={{ 
                    ...styles.paragraph, 
                    textAlign: item.alignment || 'left',
                    fontSize: item.fontSize || 11,
                    fontWeight: item.fontWeight || 'normal',
                    color: item.color || '#000'
                  }}
                >
                  {item.text}
                </Text>
              );
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