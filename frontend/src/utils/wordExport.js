import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Header,
  Footer,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  VerticalAlign
} from "docx";
import { saveAs } from "file-saver";

// Async HTML Parser for Docx (Text Only - Images Skipped)
async function parseHtmlToDocxParagraphs(htmlContent, isConclusion = false) {
  if (!htmlContent || !htmlContent.trim()) return [];

  const paragraphs = [];

  if (typeof document !== 'undefined') {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;

    // Recursive function to process nodes into Runs
    const processNode = async (node, parentStyles = {}) => {
      // 1. Handle Text Nodes
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent;
        if (text) {
          // Default size 24 (12pt)
          const size = parentStyles.size || 24; 
          return [new TextRun({ text, ...parentStyles, size })];
        }
        return [];
      }

      // 2. Handle Element Nodes
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName.toLowerCase();
        
        // --- IMAGE HANDLING: SKIPPED AS REQUESTED ---
        if (tagName === 'img') {
          return []; 
        }

        // --- TEXT STYLING ---
        const newStyles = { ...parentStyles };
        
        // Font Size
        if (node.style.fontSize) {
            const px = parseInt(node.style.fontSize);
            if (!isNaN(px)) newStyles.size = Math.round(px * 1.5);
        }

        // Heading Defaults
        if (tagName === 'h1') newStyles.size = 48; // 24pt
        if (tagName === 'h2') newStyles.size = 36; // 18pt
        if (tagName === 'h3') newStyles.size = 28; // 14pt

        // Decoration
        if (node.style.fontWeight === 'bold') newStyles.bold = true;
        if (node.style.fontStyle === 'italic') newStyles.italics = true;
        if (node.style.textDecoration === 'underline') newStyles.underline = {};

        if (['strong', 'b', 'h1', 'h2', 'h3'].includes(tagName)) newStyles.bold = true;
        if (['em', 'i'].includes(tagName)) newStyles.italics = true;
        if (tagName === 'u') newStyles.underline = {};

        if (isConclusion) {
          newStyles.bold = true;
        }

        const childRuns = [];
        const childNodes = Array.from(node.childNodes);
        
        for (const child of childNodes) {
          const runs = await processNode(child, newStyles);
          if (runs && runs.length > 0) {
            childRuns.push(...runs);
          }
        }

        return childRuns;
      }
      return [];
    };

    // Iterate over top-level blocks
    const children = Array.from(tempDiv.children);
    
    // Fallback if no block children
    if (children.length === 0 && tempDiv.childNodes.length > 0) {
       const runs = await processNode(tempDiv);
       if(runs.length > 0) {
         paragraphs.push(new Paragraph({ children: runs }));
       }
    } else {
        for (const child of children) {
            const runs = await processNode(child);

            if (runs && runs.length > 0) {
                // Determine alignment
                let alignment = AlignmentType.LEFT;
                const styleAlign = child.style.textAlign;
                const attrAlign = child.getAttribute('align'); 

                if (styleAlign === 'center' || attrAlign === 'center') {
                    alignment = AlignmentType.CENTER;
                } else if (styleAlign === 'right' || attrAlign === 'right') {
                    alignment = AlignmentType.RIGHT;
                } else if (styleAlign === 'justify' || attrAlign === 'justify') {
                    alignment = AlignmentType.JUSTIFIED;
                }

                paragraphs.push(new Paragraph({
                    children: runs,
                    alignment: alignment,
                    spacing: { after: 100 }
                }));
            }
        }
    }
  }

  return paragraphs;
}

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
              children: [new TextRun({ text: "IDENTIFICATION DU PATIENT", bold: true, size: 24 })],
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
                new TextRun({ text: "Prénom: ", bold: true, size: 24 }),
                new TextRun({ text: firstName, bold: true, size: 24 })
              ]
            })],
            width: { size: 40, type: WidthType.PERCENTAGE },
            borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }
          }),
          new TableCell({
            children: [new Paragraph({
              children: [
                new TextRun({ text: "Age: ", bold: true, size: 24 }),
                new TextRun({ text: age ? `${age}` : '', bold: true, size: 24 })
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

const createConclusionBox = async (conclusionHtml) => {
  const conclusionParagraphs = await parseHtmlToDocxParagraphs(conclusionHtml, true);
  
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
              ...conclusionParagraphs
            ],
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 100, bottom: 100, left: 100, right: 100 }
          })
        ]
      })
    ]
  });
};

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

  const reportDate = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  // --- HEADER PROCESSING ---
  let headerChildren = [];
  if (clinicData?.headerContent) {
    headerChildren = await parseHtmlToDocxParagraphs(clinicData.headerContent);
  } else {
    // Default Header
    const clinicName = clinicData?.name || settings.hospitalName || "Cabinet D'imagerie Médicale";
    const clinicNameArabic = clinicData?.nameArabic || "";

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
        children: [], 
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

  // --- FOOTER PROCESSING ---
  let footerChildren = [];
  if (clinicData?.footerContent) {
    footerChildren = await parseHtmlToDocxParagraphs(clinicData.footerContent);
  } else {
    // Default Footer
    const footerText = clinicData?.address || settings.footerText || "";
    const footerPhone = clinicData?.phone || "";

    footerChildren = [
      new Paragraph({
        children: [], 
        border: {
          top: { style: BorderStyle.SINGLE, size: 6, color: "000000" }
        },
        spacing: { before: 200, after: 100 }
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `${footerText}   ${footerPhone}`,
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

  // --- BODY CONTENT PROCESSING ---
  const techniqueParagraphs = technique ? await parseHtmlToDocxParagraphs(technique) : [];
  const findingsParagraphs = await parseHtmlToDocxParagraphs(findings || reportContent);
  const conclusionTable = conclusion ? await createConclusionBox(conclusion) : null;

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 720, right: 720, bottom: 720, left: 720 }
        }
      },
      headers: headers,
      footers: footers,
      children: [
        new Paragraph({
          children: [new TextRun({ text: reportDate, size: 24 })],
          alignment: AlignmentType.RIGHT,
          spacing: { after: 200 }
        }),

        createPatientTable(lastName, firstName, patientAge),

        new Paragraph({ text: "", spacing: { after: 200 } }),

        createExamTitle(studyDescription || modality || 'Examen'),

        new Paragraph({ text: "", spacing: { after: 200 } }),

        ...(technique ? [
          new Paragraph({
            children: [new TextRun({ text: "Technique d'examen :", bold: true, underline: { type: "single" }, italics: true, size: 24 })],
            spacing: { after: 100 }
          }),
          ...techniqueParagraphs,
          new Paragraph({ text: "", spacing: { after: 200 } })
        ] : []),

        new Paragraph({
          children: [new TextRun({ text: "Résultat :", bold: true, underline: { type: "single" }, size: 24 })],
          spacing: { after: 100 }
        }),
        ...findingsParagraphs,

        new Paragraph({ text: "", spacing: { after: 300 } }),

        ...(conclusionTable ? [conclusionTable] : [])
      ],
    }],
  });

  Packer.toBlob(doc).then((blob) => {
    const filename = `${lastName}_${firstName}_${studyDescription || 'Report'}.docx`;
    saveAs(blob, filename);
  });
};

export const exportToWord = async (
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
  const parser = new DOMParser();
  const doc = parser.parseFromString(reportContent, 'text/html');

  const techniqueDiv = doc.querySelector('.technique');
  const findingsDiv = doc.querySelector('.findings');
  const conclusionDiv = doc.querySelector('.conclusion');

  const reportData = {
    patientName,
    patientId: patientID,
    patientAge: patientAge,
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

export const generateWordDocument = async (report, clinic, patientAge) => {
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
    findingsContent = report.content || '';
    conclusionContent = report.conclusion || '';
  }

  const reportData = {
    patientName: report.patientName,
    patientId: report.patientId,
    patientAge: patientAge || report.patientAge,
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
    footerText: clinic?.address || ""
  };

  return downloadWordReport(reportData, clinicData, settings);
};