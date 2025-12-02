import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  Header,
  Footer,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  VerticalAlign,
} from "docx";
import { saveAs } from "file-saver";

/**
 * Robust Image Fetcher
 * Fetches data and ensures valid ArrayBuffer.
 */
async function getImageData(src) {
  if (!src) return null;
  try {
    // Handle Base64 images
    if (src.startsWith("data:")) {
      const base64Data = src.split(",")[1];
      if (!base64Data) return null;
      
      const binaryString = window.atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer;
    }
    
    // Handle regular URLs
    const response = await fetch(src);
    if (!response.ok) return null;
    const blob = await response.blob();
    if (blob.size === 0) return null;
    return await blob.arrayBuffer();
  } catch (error) {
    console.warn("Failed to load image for DOCX:", src, error);
    return null;
  }
}

/**
 * HTML Parser for Docx
 * Now accepts an options object: { isConclusion: boolean, isHeader: boolean }
 */
async function parseHtmlToDocxContent(htmlContent, options = {}) {
  // Destructure options with defaults
  const { isConclusion = false, isHeader = false } = options;

  if (!htmlContent || !htmlContent.trim()) return [];

  const docxElements = [];

  if (typeof document !== "undefined") {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlContent;

    const getAlignment = (element) => {
      const styleAlign = element.style.textAlign;
      const attrAlign = element.getAttribute("align");
      if (styleAlign === "center" || attrAlign === "center")
        return AlignmentType.CENTER;
      if (styleAlign === "right" || attrAlign === "right")
        return AlignmentType.RIGHT;
      if (styleAlign === "justify" || attrAlign === "justify")
        return AlignmentType.JUSTIFIED;
      return AlignmentType.LEFT;
    };

    const processInlineNodes = async (node, parentStyles = {}) => {
      // 1. Text Nodes
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.replace(
          /[\x00-\x08\x0B\x0C\x0E-\x1F]/g,
          ""
        );
        if (text) {
          const size = parentStyles.size || 24;
          return [new TextRun({ text, ...parentStyles, size })];
        }
        return [];
      }

      // 2. Element Nodes
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName.toLowerCase();

        // --- IMAGE HANDLING WITH AUTO-RESIZING ---
        if (tagName === "img") {
          const src = node.getAttribute("src");
          if (src) {
            try {
              console.log('🖼️ Processing image:', {
                src: src.substring(0, 50) + '...',
                isHeader,
                width: node.getAttribute("width"),
                height: node.getAttribute("height")
              });
              
              const imageBuffer = await getImageData(src);
              if (imageBuffer && imageBuffer.byteLength > 0) {
                console.log('✅ Image loaded successfully:', {
                  bufferSize: imageBuffer.byteLength,
                  bufferSizeKB: (imageBuffer.byteLength / 1024).toFixed(2) + ' KB'
                });
                
                // For headers/footers, use fixed square dimensions (1.04 inches = 75 pixels)
                let finalW, finalH;

                if (isHeader) {
                  // HEADER LOGIC: Use 1.04" square (75px) for consistent display
                  finalW = 75;
                  finalH = 75;
                  console.log('📐 Header image dimensions set to:', finalW, 'x', finalH);
                } else {
                  // BODY LOGIC: Get original dimensions from HTML
                  let originalW =
                    parseInt(node.getAttribute("width") || node.style.width) || 100;
                  let originalH =
                    parseInt(node.getAttribute("height") || node.style.height) ||
                    100;

                  // Validate dimensions
                  if (isNaN(originalW) || originalW <= 0) originalW = 100;
                  if (isNaN(originalH) || originalH <= 0) originalH = 100;

                  // Cap at max width and maintain aspect ratio
                  const MAX_PAGE_WIDTH = 500;
                  if (originalW > MAX_PAGE_WIDTH) {
                    const ratio = originalH / originalW;
                    finalW = MAX_PAGE_WIDTH;
                    finalH = Math.round(finalW * ratio);
                  } else {
                    finalW = originalW;
                    finalH = originalH;
                  }

                  // Final safety bounds
                  finalW = Math.max(10, Math.min(600, Math.round(finalW)));
                  finalH = Math.max(10, Math.min(600, Math.round(finalH)));
                  console.log('📐 Body image dimensions set to:', finalW, 'x', finalH);
                }

                return [
                  new ImageRun({
                    data: imageBuffer,
                    transformation: {
                      width: finalW,
                      height: finalH,
                    },
                  }),
                ];
              } else {
                console.warn('⚠️ Image buffer is empty or null');
              }
            } catch (err) {
              console.error("❌ Error processing image:", err);
            }
          }
          return [];
        }

        // --- STYLES ---
        const newStyles = { ...parentStyles };

        if (node.style.fontSize) {
          const px = parseInt(node.style.fontSize);
          if (!isNaN(px)) newStyles.size = Math.round(px * 1.5);
        }

        if (tagName === "h1") newStyles.size = 48;
        if (tagName === "h2") newStyles.size = 36;
        if (tagName === "h3") newStyles.size = 28;

        if (["strong", "b", "h1", "h2", "h3"].includes(tagName))
          newStyles.bold = true;
        if (["em", "i"].includes(tagName)) newStyles.italics = true;
        if (tagName === "u") newStyles.underline = {};
        if (node.style.fontWeight === "bold") newStyles.bold = true;
        if (node.style.fontStyle === "italic") newStyles.italics = true;
        if (node.style.textDecoration === "underline") newStyles.underline = {};

        if (isConclusion) newStyles.bold = true;

        const childRuns = [];
        const childNodes = Array.from(node.childNodes);

        for (const child of childNodes) {
          const runs = await processInlineNodes(child, newStyles);
          if (runs && runs.length > 0) childRuns.push(...runs);
        }
        return childRuns;
      }
      return [];
    };

    // Recursive Block Processor
    const processBlockNode = async (node) => {
      const tagName = node.tagName ? node.tagName.toLowerCase() : "";

      // --- LIST HANDLING (UL/OL) ---
      if (tagName === "ul" || tagName === "ol") {
        const listItems = Array.from(node.querySelectorAll("li"));
        const listParagraphs = [];

        for (const li of listItems) {
          const runs = await processInlineNodes(li);
          if (runs.length > 0) {
            listParagraphs.push(
              new Paragraph({
                children: [
                  new TextRun({ text: "• ", size: 24 }), // Bullet point
                  ...runs,
                ],
                spacing: { after: 100 },
                indent: { left: 360 }, // Indent list items
              })
            );
          }
        }
        return listParagraphs;
      }

      if (tagName === "table") {
        const rows = [];
        const trs = Array.from(node.querySelectorAll("tr"));

        for (const tr of trs) {
          const cells = [];
          const tds = Array.from(tr.querySelectorAll("td, th"));

          for (const td of tds) {
            const cellChildren = [];
            const cellChildNodes = Array.from(td.childNodes);

            const inlineRuns = [];
            for (const child of cellChildNodes) {
              if (
                child.nodeType === Node.ELEMENT_NODE &&
                ["div", "p", "table", "ul", "ol", "h1", "h2", "h3"].includes(
                  child.tagName.toLowerCase()
                )
              ) {
                if (inlineRuns.length > 0) {
                  cellChildren.push(
                    new Paragraph({
                      children: [...inlineRuns],
                      alignment: getAlignment(td),
                    })
                  );
                  inlineRuns.length = 0;
                }
                const blocks = await processBlockNode(child);
                if (blocks)
                  cellChildren.push(
                    ...(Array.isArray(blocks) ? blocks : [blocks])
                  );
              } else {
                const runs = await processInlineNodes(child);
                inlineRuns.push(...runs);
              }
            }
            if (inlineRuns.length > 0) {
              cellChildren.push(
                new Paragraph({
                  children: inlineRuns,
                  alignment: getAlignment(td),
                })
              );
            }

            // Fallback for empty cells
            if (cellChildren.length === 0) {
              cellChildren.push(new Paragraph({ text: "" }));
            }

            // Borders
            const tableBorder = node.getAttribute("border");
            const hasBorder =
              (tableBorder && tableBorder !== "0") ||
              (node.style.border && node.style.border !== "none");
            const borderStyle = hasBorder
              ? BorderStyle.SINGLE
              : BorderStyle.NONE;
            const borderSize = hasBorder ? 4 : 0;

            // Width
            let widthVal = Math.floor(100 / (tds.length || 1));
            const tdWidth = td.getAttribute("width");
            if (tdWidth) {
              const parsed = parseInt(tdWidth);
              if (!isNaN(parsed)) widthVal = Math.round(parsed);
            }

            cells.push(
              new TableCell({
                children: cellChildren,
                width: { size: widthVal, type: WidthType.PERCENTAGE },
                borders: {
                  top: { style: borderStyle, size: borderSize },
                  bottom: { style: borderStyle, size: borderSize },
                  left: { style: borderStyle, size: borderSize },
                  right: { style: borderStyle, size: borderSize },
                },
                verticalAlign: VerticalAlign.CENTER,
              })
            );
          }
          rows.push(new TableRow({ children: cells }));
        }

        return new Table({
          rows: rows,
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
          },
        });
      }

      const alignment =
        node.nodeType === Node.ELEMENT_NODE
          ? getAlignment(node)
          : AlignmentType.LEFT;
      const runs = await processInlineNodes(node);

      if (runs.length > 0) {
        return new Paragraph({
          children: runs,
          alignment: alignment,
          spacing: { after: 100 },
        });
      }
      return null;
    };

    const children = Array.from(tempDiv.children);

    if (children.length === 0 && tempDiv.childNodes.length > 0) {
      const runs = await processInlineNodes(tempDiv);
      if (runs.length > 0) docxElements.push(new Paragraph({ children: runs }));
    } else {
      for (const child of children) {
        const result = await processBlockNode(child);
        if (result) {
          if (Array.isArray(result)) docxElements.push(...result);
          else docxElements.push(result);
        }
      }
    }
  }

  return docxElements;
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
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "IDENTIFICATION DU PATIENT",
                    bold: true,
                    size: 24,
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
            columnSpan: 3,
            borders: { bottom: { style: BorderStyle.SINGLE, size: 2 } },
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "Nom: ", bold: true, size: 24 }),
                  new TextRun({ text: lastName, bold: true, size: 24 }),
                ],
              }),
            ],
            width: { size: 40, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "Prénom: ", bold: true, size: 24 }),
                  new TextRun({ text: firstName, bold: true, size: 24 }),
                ],
              }),
            ],
            width: { size: 40, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "Age: ", bold: true, size: 24 }),
                  new TextRun({
                    text: age ? `${age}` : "",
                    bold: true,
                    size: 24,
                  }),
                ],
              }),
            ],
            width: { size: 20, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
            },
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
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `COMPTE RENDU DE ${title.toUpperCase()}`,
                    bold: true,
                    size: 24,
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        ],
      }),
    ],
  });
};

const createConclusionBox = async (conclusionHtml) => {
  const conclusionContent = await parseHtmlToDocxContent(conclusionHtml, {
    isConclusion: true,
  });

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
                children: [
                  new TextRun({
                    text: "Conclusion :",
                    bold: true,
                    underline: { type: "single" },
                    italics: true,
                    size: 24,
                  }),
                ],
                spacing: { after: 100 },
              }),
              ...conclusionContent,
            ],
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
          }),
        ],
      }),
    ],
  });
};

export const downloadWordReport = async (
  reportData,
  clinicData = null,
  settings = {}
) => {
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
    technique,
  } = reportData;

  let lastName = "N/A";
  let firstName = "N/A";

  if (patientName) {
    if (patientName.includes("^")) {
      const nameParts = patientName.split("^");
      lastName = nameParts[0]?.trim() || "N/A";
      firstName = nameParts[1]?.trim() || "N/A";
    } else {
      const nameParts = patientName.trim().split(/\s+/);
      if (nameParts.length >= 2) {
        firstName = nameParts[0];
        lastName = nameParts.slice(1).join(" ");
      } else {
        lastName = nameParts[0] || "N/A";
      }
    }
  }

  const reportDate = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  // --- HEADER PROCESSING ---
  let headerChildren = [];
  if (clinicData?.headerContent) {
    // PASS isHeader: true to force strict resizing
    headerChildren = await parseHtmlToDocxContent(clinicData.headerContent, {
      isHeader: true,
    });
  } else {
    const clinicName =
      clinicData?.name ||
      settings.hospitalName ||
      "Cabinet D'imagerie Médicale";
    const clinicNameArabic = clinicData?.nameArabic || "";

    headerChildren = [
      new Paragraph({
        children: [
          new TextRun({ text: clinicNameArabic, size: 24, bold: true }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: clinicName,
            size: 22,
            bold: false,
            italics: true,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }),
      new Paragraph({
        children: [],
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
        },
        spacing: { after: 200 },
      }),
    ];
  }

  if (headerChildren.length === 0) {
    headerChildren.push(new Paragraph({ text: "" }));
  }

  const headers = {
    default: new Header({
      children: headerChildren,
    }),
  };

  // --- FOOTER PROCESSING ---
  let footerChildren = [];
  if (clinicData?.footerContent) {
    // Footers also benefit from resizing
    footerChildren = await parseHtmlToDocxContent(clinicData.footerContent, {
      isHeader: true,
    });
  } else {
    const footerText = clinicData?.address || settings.footerText || "";
    const footerPhone = clinicData?.phone || "";

    footerChildren = [
      new Paragraph({
        children: [],
        border: {
          top: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
        },
        spacing: { before: 200, after: 100 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `${footerText}   ${footerPhone}`,
            size: 18,
            color: "666666",
          }),
        ],
        alignment: AlignmentType.CENTER,
      }),
    ];
  }

  if (footerChildren.length === 0) {
    footerChildren.push(new Paragraph({ text: "" }));
  }

  const footers = {
    default: new Footer({
      children: footerChildren,
    }),
  };

  // --- BODY CONTENT PROCESSING ---
  const techniqueParagraphs = technique
    ? await parseHtmlToDocxContent(technique)
    : [];
  const findingsParagraphs = await parseHtmlToDocxContent(
    findings || reportContent
  );
  const conclusionTable = conclusion
    ? await createConclusionBox(conclusion)
    : null;

  // --- DEBUG LOGGING ---
  console.group('📄 Word Document Generation Debug');
  console.log('Header children count:', headerChildren.length);
  console.log('Header children types:', headerChildren.map(c => c.constructor.name));
  console.log('Footer children count:', footerChildren.length);
  console.log('Footer children types:', footerChildren.map(c => c.constructor.name));
  console.log('Technique paragraphs:', techniqueParagraphs.length);
  console.log('Findings paragraphs:', findingsParagraphs.length);
  console.log('Has conclusion table:', !!conclusionTable);
  console.groupEnd();

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        headers: headers,
        footers: footers,
        children: [
          new Paragraph({
            children: [new TextRun({ text: reportDate, size: 24 })],
            alignment: AlignmentType.RIGHT,
            spacing: { after: 200 },
          }),

          createPatientTable(lastName, firstName, patientAge),

          new Paragraph({ text: "", spacing: { after: 200 } }),

          createExamTitle(studyDescription || modality || "Examen"),

          new Paragraph({ text: "", spacing: { after: 200 } }),

          ...(technique
            ? [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "Technique d'examen :",
                      bold: true,
                      underline: { type: "single" },
                      italics: true,
                      size: 24,
                    }),
                  ],
                  spacing: { after: 100 },
                }),
                ...techniqueParagraphs,
                new Paragraph({ text: "", spacing: { after: 200 } }),
              ]
            : []),

          new Paragraph({
            children: [
              new TextRun({
                text: "Résultat :",
                bold: true,
                underline: { type: "single" },
                size: 24,
              }),
            ],
            spacing: { after: 100 },
          }),
          ...findingsParagraphs,

          new Paragraph({ text: "", spacing: { after: 300 } }),

          ...(conclusionTable ? [conclusionTable] : []),
        ],
      },
    ],
  });

  Packer.toBlob(doc).then((blob) => {
    console.log('📦 DOCX Blob generated:', {
      size: blob.size,
      type: blob.type,
      sizeInKB: (blob.size / 1024).toFixed(2) + ' KB'
    });
    
    // Validate blob size
    if (blob.size === 0) {
      console.error('❌ ERROR: Generated blob has 0 bytes!');
      alert('Error: Generated document is empty. Check console for details.');
      return;
    }
    
    if (blob.size < 1000) {
      console.warn('⚠️ WARNING: Generated blob is very small, might be corrupted');
    }
    
    const filename = `${lastName}_${firstName}_${
      studyDescription || "Report"
    }.docx`;
    console.log('💾 Saving file:', filename);
    saveAs(blob, filename);
  }).catch((error) => {
    console.error('❌ FATAL ERROR generating DOCX:', error);
    console.error('Error stack:', error.stack);
    alert('Failed to generate Word document. Check console for details.');
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
  const doc = parser.parseFromString(reportContent, "text/html");

  const techniqueDiv = doc.querySelector(".technique");
  const findingsDiv = doc.querySelector(".findings");
  const conclusionDiv = doc.querySelector(".conclusion");

  const reportData = {
    patientName,
    patientId: patientID,
    patientAge: patientAge,
    studyDescription,
    studyDate,
    modality: "",
    reportContent: findingsDiv ? findingsDiv.innerHTML : reportContent,
    findings: findingsDiv ? findingsDiv.innerHTML : reportContent,
    technique: techniqueDiv ? techniqueDiv.innerHTML : "",
    conclusion: conclusionDiv ? conclusionDiv.innerHTML : "",
  };

  return downloadWordReport(reportData, clinicData, {
    hospitalName,
    footerText,
  });
};

export const generateWordDocument = async (report, clinic, patientAge) => {
  let techniqueContent = "";
  let findingsContent = "";
  let conclusionContent = "";

  if (typeof document !== "undefined" && report.content) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(report.content, "text/html");

    const techniqueDiv = doc.querySelector(".technique");
    const findingsDiv = doc.querySelector(".findings");
    const conclusionDiv = doc.querySelector(".conclusion");

    techniqueContent = techniqueDiv ? techniqueDiv.innerHTML : "";
    findingsContent = findingsDiv ? findingsDiv.innerHTML : report.content;
    conclusionContent = conclusionDiv
      ? conclusionDiv.innerHTML
      : report.conclusion || "";
  } else {
    findingsContent = report.content || "";
    conclusionContent = report.conclusion || "";
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
    technique: techniqueContent,
  };

  const clinicData = clinic
    ? {
        name: clinic.name,
        nameArabic: clinic.nameArabic,
        address: clinic.address,
        phone: clinic.phone,
        email: clinic.email,
        headerContent: clinic.headerContent,
        footerContent: clinic.footerContent,
      }
    : null;

  const settings = {
    hospitalName: clinic?.name || "Cabinet D'imagerie Médicale",
    footerText: clinic?.address || "",
  };

  return downloadWordReport(reportData, clinicData, settings);
};
