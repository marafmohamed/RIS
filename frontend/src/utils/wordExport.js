import { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType, TextRun, AlignmentType, BorderStyle, Header, Footer, ImageRun, VerticalAlign } from "docx";
import { saveAs } from "file-saver";

/**
 * Generate and download a professional medical report in Word format
 * Matches the provided sample structure with Clinic customization
 */
export const downloadWordReport = async (reportData, clinicData = null, settings = {}) => {
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
    technique
  } = reportData;

  // Parse patient name
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

  // Format date
  const reportDate = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  // Prepare Header
  let headerChildren = [];
  if (clinicData?.headerContent) {
    headerChildren = parseHtmlToDocxParagraphs(clinicData.headerContent);
  } else {
    // Fallback to text header
    const clinicName = clinicData?.name || settings.hospitalName || "Cabinet D'imagerie Médicale Dahra";
    const clinicNameArabic = clinicData?.nameArabic || "عيادة التصوير الطبي الظهرة";

    headerChildren = [
      new Paragraph({
        children: [
          new TextRun({ text: clinicNameArabic, size: 24, bold: true }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 }
      }),
      new Paragraph({
        children: [
          new TextRun({ text: clinicName, size: 22, bold: false, italics: true }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 }
      }),
      new Paragraph({
        children: [], // Spacer line
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000" }
        },
        spacing: { after: 200 }
      })
    ];
  }

  const headers = {
    default: new Header({
      children: headerChildren,
    }),
  };


  // Prepare Footer
  let footerChildren = [];
  if (clinicData?.footerContent) {
    footerChildren = parseHtmlToDocxParagraphs(clinicData.footerContent);
  } else {
    // Fallback to text footer
    const footerText = clinicData?.address || settings.footerText || "Cité Bousrour en face les pompiers Mazouna Relizane";
    const footerPhone = clinicData?.phone || "Tel 0779 00 46 56";
    const footerArabic = "حي بوسرور مقابل الحماية المدنية مازونة غليزان";

    footerChildren = [
      new Paragraph({
        children: [], // Spacer line
        border: {
          top: { style: BorderStyle.SINGLE, size: 6, color: "000000" }
        },
        spacing: { before: 200, after: 100 }
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `${footerText}   ${footerPhone}   ${footerArabic}`,
            size: 18,
            color: "666666"
          })
        ],
        alignment: AlignmentType.CENTER,
      })
    ];
  }

  const footers = {
    default: new Footer({
      children: footerChildren,
    }),
  };

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 720, // 0.5 inch
            right: 720,
            bottom: 720,
            left: 720,
          }
        }
      },
      headers: headers,
      footers: footers,
      children: [
        // Date (Top Right)
        new Paragraph({
          children: [new TextRun({ text: reportDate, size: 24 })],
          alignment: AlignmentType.RIGHT,
          spacing: { after: 200 }
        }),

        // PATIENT IDENTIFICATION TABLE
        createPatientTable(lastName, firstName, patientAge),

        new Paragraph({ text: "", spacing: { after: 200 } }),

        // EXAM TITLE
        createExamTitle(studyDescription || modality || 'TDM'),

        new Paragraph({ text: "", spacing: { after: 200 } }),

        // Motif (if available - placeholder for now as it's not in reportData usually)
        // new Paragraph({
        //   children: [
        //     new TextRun({ text: "Motif : ", bold: true, underline: { type: "single" }, size: 24 }),
        //     new TextRun({ text: "Douleurs...", size: 24 })
        //   ],
        //   spacing: { after: 200 }
        // }),

        // TECHNIQUE
        ...(technique ? [
          new Paragraph({
            children: [new TextRun({ text: "Technique d'examen :", bold: true, underline: { type: "single" }, italics: true, size: 24 })],
            spacing: { after: 100 }
          }),
          ...parseHtmlToDocxParagraphs(technique),
          new Paragraph({ text: "", spacing: { after: 200 } })
        ] : []),

        // RESULTAT (Findings)
        new Paragraph({
          children: [new TextRun({ text: "Résultat :", bold: true, underline: { type: "single" }, size: 24 })],
          spacing: { after: 100 }
        }),
        ...parseHtmlToDocxParagraphs(findings || reportContent),

        new Paragraph({ text: "", spacing: { after: 300 } }),

        // CONCLUSION
        ...(conclusion ? [
          createConclusionBox(conclusion)
        ] : [])
      ],
    }],
  });

  // Generate and download
  Packer.toBlob(doc).then((blob) => {
    const filename = `${lastName}_${firstName}_${studyDescription || 'Report'}.docx`;
    saveAs(blob, filename);
  });
};

// Helper to fetch image from URL/Base64
const fetchImage = async (url) => {
  const response = await fetch(url);
  const blob = await response.blob();
  return await blob.arrayBuffer();
};

// Helper to create Patient Table
const createPatientTable = (lastName, firstName, age) => {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2 },
      bottom: { style: BorderStyle.SINGLE, size: 2 },
      left: { style: BorderStyle.SINGLE, size: 2 },
      right: { style: BorderStyle.SINGLE, size: 2 },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: "IDENTIFICATION  DU PATIENT", bold: true, size: 24 })],
              alignment: AlignmentType.CENTER
            })],
            columnSpan: 3,
            borders: { bottom: { style: BorderStyle.SINGLE, size: 2 } }
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({
              children: [
                new TextRun({ text: "Nom: ", bold: true, size: 24 }),
                new TextRun({ text: lastName, bold: true, size: 24 })
              ]
            })],
            width: { size: 40, type: WidthType.PERCENTAGE },
            borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }
          }),
          new TableCell({
            children: [new Paragraph({
              children: [
                new TextRun({ text: "Prénom : ", bold: true, size: 24 }),
                new TextRun({ text: firstName, bold: true, size: 24 })
              ]
            })],
            width: { size: 40, type: WidthType.PERCENTAGE },
            borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }
          }),
          new TableCell({
            children: [new Paragraph({
              children: [
                new TextRun({ text: "Age : ", bold: true, size: 24 }),
                new TextRun({ text: age ? `${age} ANS` : '', bold: true, size: 24 })
              ]
            })],
            width: { size: 20, type: WidthType.PERCENTAGE },
            borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE } }
          }),
        ],
      }),
    ],
  });
};

// Helper to create Exam Title
const createExamTitle = (title) => {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2 },
      bottom: { style: BorderStyle.SINGLE, size: 2 },
      left: { style: BorderStyle.SINGLE, size: 2 },
      right: { style: BorderStyle.SINGLE, size: 2 },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: `COMPTE RENDU DE ${title.toUpperCase()}`, bold: true, size: 24 })],
              alignment: AlignmentType.CENTER
            })],
          })
        ]
      })
    ]
  });
};

// Helper to create Conclusion Box
const createConclusionBox = (conclusionHtml) => {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2 },
      bottom: { style: BorderStyle.SINGLE, size: 2 },
      left: { style: BorderStyle.SINGLE, size: 2 },
      right: { style: BorderStyle.SINGLE, size: 2 },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: "Conclusion :", bold: true, underline: { type: "single" }, italics: true, size: 24 })],
                spacing: { after: 100 }
              }),
              ...parseHtmlToDocxParagraphs(conclusionHtml, true) // Pass true for conclusion mode (centered/bold if needed)
            ],
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 100, bottom: 100, left: 100, right: 100 }
          })
        ]
      })
    ]
  });
};

// HTML Parser
function parseHtmlToDocxParagraphs(htmlContent, isConclusion = false) {
  if (!htmlContent || !htmlContent.trim()) return [];

  const paragraphs = [];

  if (typeof document !== 'undefined') {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;

    const processNode = (node, parentStyles = {}) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent;
        if (text) {
          // Default size 24 (12pt) unless specified
          const size = parentStyles.size || 24;
          return new TextRun({ text, ...parentStyles, size });
        }
        return null;
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName.toLowerCase();
        const newStyles = { ...parentStyles };

        // Handle styles
        if (node.style.fontSize) {
          // Convert px to half-points (docx uses half-points, e.g. 24 = 12pt)
          const px = parseInt(node.style.fontSize);
          if (!isNaN(px)) {
            newStyles.size = px * 2; // Approximate conversion: 1px ~= 0.75pt, but usually 16px = 12pt = 24 half-points. 
            // Actually Tiptap uses px. Word uses half-points.
            // 16px (web) ~= 12pt (word) = 24 half-points.
            // So factor is 1.5? No, 16 * 1.5 = 24. 
            // Let's use 1.5 multiplier for px to half-points.
            newStyles.size = Math.round(px * 1.5);
          }
        }
        if (node.style.fontWeight === 'bold') newStyles.bold = true;
        if (node.style.fontStyle === 'italic') newStyles.italics = true;
        if (node.style.textDecoration === 'underline') newStyles.underline = {};

        // Handle tags
        if (tagName === 'strong' || tagName === 'b') newStyles.bold = true;
        if (tagName === 'em' || tagName === 'i') newStyles.italics = true;
        if (tagName === 'u') newStyles.underline = {};

        // Conclusion specific: usually bold and centered
        if (isConclusion) {
          newStyles.bold = true;
        }

        const runs = [];
        Array.from(node.childNodes).forEach(child => {
          const run = processNode(child, newStyles);
          if (run) {
            if (Array.isArray(run)) runs.push(...run);
            else runs.push(run);
          }
        });

        return runs;
      }
      return null;
    };

    Array.from(tempDiv.children).forEach(child => {
      const tagName = child.tagName.toLowerCase();
      const runs = processNode(child);

      if (runs && runs.length > 0) {
        let alignment = AlignmentType.LEFT;
        if (child.style.textAlign === 'center') alignment = AlignmentType.CENTER;
        if (child.style.textAlign === 'right') alignment = AlignmentType.RIGHT;
        if (child.style.textAlign === 'justify') alignment = AlignmentType.JUSTIFIED;

        if (isConclusion) alignment = AlignmentType.CENTER;

        if (tagName === 'ul' || tagName === 'ol') {
          // Handle lists (simplified: just paragraphs with bullets)
          // Ideally we should process LIs
          Array.from(child.children).forEach(li => {
            const liRuns = processNode(li);
            if (liRuns) {
              paragraphs.push(new Paragraph({
                children: liRuns,
                bullet: { level: 0 },
                spacing: { after: 100 }
              }));
            }
          });
        } else {
          paragraphs.push(new Paragraph({
            children: runs,
            alignment: alignment,
            spacing: { after: 100 }
          }));
        }
      }
    });

    // Fallback for text without tags
    if (paragraphs.length === 0 && tempDiv.textContent.trim()) {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: tempDiv.textContent.trim(), size: 24, bold: isConclusion })],
        alignment: isConclusion ? AlignmentType.CENTER : AlignmentType.LEFT
      }));
    }
  }

  return paragraphs;
}

/**
 * Wrapper function
 */
export const exportToWord = async (
  reportContent,
  patientName,
  patientID,
  studyDescription,
  studyDate,
  hospitalName, // Legacy
  footerText, // Legacy
  clinicData = null // New
) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(reportContent, 'text/html');

  const techniqueDiv = doc.querySelector('.technique');
  const findingsDiv = doc.querySelector('.findings');
  const conclusionDiv = doc.querySelector('.conclusion');

  const reportData = {
    patientName,
    patientId: patientID,
    patientAge: null, // Need to pass age if available
    studyDescription,
    studyDate,
    modality: '',
    reportContent: findingsDiv ? findingsDiv.innerHTML : reportContent,
    findings: findingsDiv ? findingsDiv.innerHTML : reportContent,
    technique: techniqueDiv ? techniqueDiv.innerHTML : '',
    conclusion: conclusionDiv ? conclusionDiv.innerHTML : '',
  };

  return downloadWordReport(reportData, clinicData, { hospitalName, footerText });
};

/**
 * Generate Word document from report and clinic data (for dashboard downloads)
 */
export const generateWordDocument = async (report, clinic) => {
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
    reportContent: report.content,
    findings: findingsContent,
    conclusion: conclusionContent,
    technique: techniqueContent
  };

  const clinicData = clinic ? {
    name: clinic.name,
    nameArabic: clinic.nameArabic,
    address: clinic.address,
    phone: clinic.phone,
    email: clinic.email,
    headerContent: clinic.headerContent,
    footerContent: clinic.footerContent
  } : null;

  const settings = {
    hospitalName: clinic?.name || "Cabinet D'imagerie Médicale",
    footerText: clinic?.address || "Cité Bousrour en face les pompiers Mazouna Relizane"
  };

  return downloadWordReport(reportData, clinicData, settings);
};


