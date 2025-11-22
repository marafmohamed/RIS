import { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType, TextRun, AlignmentType, BorderStyle, HeadingLevel, Footer } from "docx";
import { saveAs } from "file-saver";

/**
 * Generate and download a professional medical report in Word format
 * Matches the TDM CEREBRALE report template structure
 */
export const downloadWordReport = async (reportData, settings = {}) => {
  const {
    patientName,
    patientId,
    patientAge,
    studyDescription,
    studyDate,
    modality,
    reportContent,
    findings,
    conclusion,
    doctorName
  } = reportData;

  // Get hospital settings (can be overridden)
  const hospitalName = settings.hospitalName || "l'EPH MAZOUNA";
  const footerText = settings.footerText || "Cité Bousrour en face les pompiers Mazouna Relizane   Tel 0779 00 46 56   حي بوسرور مقابل الحماية المدنية مازونة غليزان";

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

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1440,    // 1 inch = 1440 twips
            right: 1440,
            bottom: 1440,
            left: 1440,
          }
        }
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              children: [
                new TextRun({ 
                  text: footerText,
                  size: 18,
                  color: "666666"
                })
              ],
              alignment: AlignmentType.CENTER,
              border: {
                top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" }
              },
              spacing: { before: 200 }
            })
          ]
        })
      },
      children: [
        // DATE (Top Right)
        new Paragraph({
          children: [new TextRun({ text: reportDate, bold: true })],
          alignment: AlignmentType.RIGHT,
          spacing: { after: 300 }
        }),

        // PATIENT IDENTIFICATION TABLE
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
            bottom: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
            left: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
            right: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ 
                    children: [new TextRun({ text: "IDENTIFICATION DU PATIENT", bold: true, size: 24 })], 
                    alignment: AlignmentType.CENTER 
                  })],
                  columnSpan: 3,
                  borders: { 
                    bottom: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
                    top: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
                    left: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
                    right: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
                  },
                  shading: { fill: "E8E8E8" }
                }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ 
                  children: [new Paragraph({ 
                    children: [
                      new TextRun({ text: "Nom : ", bold: true }),
                      new TextRun({ text: lastName })
                    ]
                  })],
                  width: { size: 33, type: WidthType.PERCENTAGE }
                }),
                new TableCell({ 
                  children: [new Paragraph({ 
                    children: [
                      new TextRun({ text: "Prénom : ", bold: true }),
                      new TextRun({ text: firstName })
                    ]
                  })],
                  width: { size: 34, type: WidthType.PERCENTAGE }
                }),
                new TableCell({ 
                  children: [new Paragraph({ 
                    children: [
                      new TextRun({ text: "Age : ", bold: true }),
                      new TextRun({ text: patientAge ? `${patientAge} ans` : 'N/A' })
                    ]
                  })],
                  width: { size: 33, type: WidthType.PERCENTAGE }
                }),
              ],
            }),
          ],
        }),

        new Paragraph({ text: "", spacing: { after: 300 } }), // Spacer

        // EXAM TYPE TITLE BLOCK
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
            bottom: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
            left: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
            right: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [new TextRun({ 
                        text: `INTERPRETATION DE ${studyDescription?.toUpperCase() || modality?.toUpperCase() || 'TDM'}`, 
                        bold: true, 
                        size: 28 
                      })],
                      alignment: AlignmentType.CENTER,
                      spacing: { before: 100, after: 100 }
                    }),
                    new Paragraph({
                      children: [new TextRun({ 
                        text: `Examen réalisé au niveau de ${hospitalName}`, 
                        bold: true,
                        size: 22
                      })],
                      alignment: AlignmentType.CENTER,
                      spacing: { after: 100 }
                    })
                  ],
                  shading: { fill: "F0F0F0" }
                })
              ]
            })
          ]
        }),

        new Paragraph({ text: "", spacing: { after: 400 } }), // Spacer

        // Insert findings content (parsed from rich text editor)
        // User creates their own section titles within the rich text editor
        ...parseHtmlToDocxParagraphs(findings || reportContent || ''),

        new Paragraph({ text: "", spacing: { after: 300 } }), // Spacer

        // CONCLUSION BOX
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    new Paragraph({ 
                      children: [new TextRun({ text: "CONCLUSION :", bold: true, size: 24 })],
                      spacing: { before: 150, after: 150 }
                    }),
                    ...parseConclusionToDocxParagraphs(conclusion)
                  ],
                  borders: {
                    top: { style: BorderStyle.DOUBLE, size: 3, color: "000000" },
                    bottom: { style: BorderStyle.DOUBLE, size: 3, color: "000000" },
                    left: { style: BorderStyle.DOUBLE, size: 3, color: "000000" },
                    right: { style: BorderStyle.DOUBLE, size: 3, color: "000000" },
                  },
                  shading: { fill: "F8F8F8" }
                })
              ]
            })
          ]
        })
      ],
    }],
  });

  // Generate and download the file
  Packer.toBlob(doc).then((blob) => {
    const filename = `${lastName}_${firstName}_${studyDescription || 'Report'}_${new Date().toISOString().split('T')[0]}.docx`;
    saveAs(blob, filename);
  });
};

/**
 * Parse HTML content from rich text editor to Word paragraphs
 * Handles formatting: bold, italic, headings, lists, line breaks
 */
function parseHtmlToDocxParagraphs(htmlContent) {
  if (!htmlContent) return [
    new Paragraph({
      children: [new TextRun({ text: "[Contenu du rapport à remplir]", italics: true, size: 22 })],
      spacing: { after: 150 }
    })
  ];

  const paragraphs = [];
  
  if (typeof document !== 'undefined') {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    
    // Process each child node
    const processNode = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.trim();
        if (text) {
          return new TextRun({ text, size: 22 });
        }
        return null;
      }
      
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName.toLowerCase();
        const text = node.textContent.trim();
        
        if (!text) return null;
        
        // Handle different HTML elements
        switch (tagName) {
          case 'strong':
          case 'b':
            return new TextRun({ text, bold: true, size: 22 });
          
          case 'em':
          case 'i':
            return new TextRun({ text, italics: true, size: 22 });
          
          case 'u':
            return new TextRun({ text, underline: {}, size: 22 });
          
          default:
            return new TextRun({ text, size: 22 });
        }
      }
      
      return null;
    };
    
    // Process block-level elements
    const children = Array.from(tempDiv.children);
    
    if (children.length === 0) {
      // No block elements, just text
      const lines = tempDiv.innerHTML.split(/<br\s*\/?>/i);
      lines.forEach(line => {
        const div = document.createElement('div');
        div.innerHTML = line;
        const text = div.textContent.trim();
        if (text) {
          paragraphs.push(
            new Paragraph({
              children: [new TextRun({ text, size: 22 })],
              spacing: { after: 150 }
            })
          );
        }
      });
    } else {
      children.forEach(child => {
        const tagName = child.tagName.toLowerCase();
        const text = child.textContent.trim();
        
        if (!text) return;
        
        if (tagName === 'p') {
          // Handle paragraphs
          const runs = [];
          Array.from(child.childNodes).forEach(node => {
            const run = processNode(node);
            if (run) runs.push(run);
          });
          
          if (runs.length > 0) {
            paragraphs.push(
              new Paragraph({
                children: runs,
                spacing: { after: 150 }
              })
            );
          }
        } else if (tagName === 'ul' || tagName === 'ol') {
          // Handle lists
          const items = Array.from(child.getElementsByTagName('li'));
          items.forEach(li => {
            const liText = li.textContent.trim();
            if (liText) {
              paragraphs.push(
                new Paragraph({
                  children: [new TextRun({ text: `• ${liText}`, size: 22 })],
                  spacing: { after: 150 },
                  indent: { left: 720 } // Indent list items
                })
              );
            }
          });
        } else if (tagName.match(/^h[1-6]$/)) {
          // Handle headings
          const level = parseInt(tagName[1]);
          const size = 32 - (level * 2); // h1=30, h2=28, etc.
          
          paragraphs.push(
            new Paragraph({
              children: [new TextRun({ text, bold: true, size })],
              spacing: { before: 200, after: 150 }
            })
          );
        } else {
          // Default: treat as paragraph
          paragraphs.push(
            new Paragraph({
              children: [new TextRun({ text, size: 22 })],
              spacing: { after: 150 }
            })
          );
        }
      });
    }
  } else {
    // Server-side fallback
    const cleanText = htmlContent
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<li>/gi, '• ')
      .replace(/<[^>]*>/g, '')
      .trim();
    
    const lines = cleanText.split('\n').filter(line => line.trim());
    
    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine) {
        paragraphs.push(
          new Paragraph({
            children: [new TextRun({ text: trimmedLine, size: 22 })],
            spacing: { after: 150 }
          })
        );
      }
    });
  }

  return paragraphs.length > 0 ? paragraphs : [
    new Paragraph({
      children: [new TextRun({ text: "[Contenu du rapport à remplir]", italics: true, size: 22 })],
      spacing: { after: 150 }
    })
  ];
}

/**
 * Parse conclusion text to paragraphs with proper line breaks
 */
function parseConclusionToDocxParagraphs(conclusion) {
  if (!conclusion || !conclusion.trim()) {
    return [
      new Paragraph({ 
        children: [new TextRun({ 
          text: "LECTURE SUR CD D'UNE IMAGERIE SANS PARTICULARITÉS SIGNIFICATIVES NOTABLES.",
          bold: true,
          italics: true,
          size: 22
        })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 100, after: 150 }
      })
    ];
  }

  const lines = conclusion.split('\n').filter(line => line.trim());
  
  return lines.map(line => 
    new Paragraph({ 
      children: [new TextRun({ 
        text: line.trim(),
        bold: true,
        italics: true,
        size: 22
      })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 50, after: 50 }
    })
  );
}

/**
 * Get exam template content (empty by default - user creates their own)
 */
export const getExamTemplate = (modality, studyDescription) => {
  return {
    findings: '',
    conclusion: ''
  };
};
