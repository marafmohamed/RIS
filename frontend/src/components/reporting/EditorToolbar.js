'use client';

import { 
  Bold, Italic, Underline, List, ListOrdered, 
  Heading1, Heading2, Table, Plus, Minus,
  AlignLeft, AlignCenter, AlignRight, AlignJustify
} from 'lucide-react';

const MEDICAL_TEMPLATES = {
  chestXRayNormal: {
    label: 'Normal Chest X-Ray',
    content: `<h2>CHEST X-RAY</h2>
<p><strong>Technique:</strong> PA and Lateral views</p>
<p><strong>Findings:</strong></p>
<ul>
<li>The lungs are clear bilaterally without evidence of focal consolidation, pleural effusion, or pneumothorax.</li>
<li>The cardiac silhouette is normal in size and configuration.</li>
<li>The mediastinal contours are unremarkable.</li>
<li>No acute bony abnormality is identified.</li>
</ul>
<p><strong>Impression:</strong> Normal chest radiograph.</p>`
  },
  brainCTNormal: {
    label: 'Normal Brain CT',
    content: `<h2>CT BRAIN WITHOUT CONTRAST</h2>
<p><strong>Technique:</strong> Axial images through the brain without IV contrast</p>
<p><strong>Findings:</strong></p>
<ul>
<li>No acute intracranial hemorrhage, mass effect, or midline shift.</li>
<li>The ventricles and sulci are normal in size and configuration for patient age.</li>
<li>No extra-axial fluid collection.</li>
<li>The visualized paranasal sinuses and mastoid air cells are clear.</li>
<li>No acute fracture.</li>
</ul>
<p><strong>Impression:</strong> No acute intracranial abnormality.</p>`
  },
  abdominalUltrasound: {
    label: 'Normal Abdominal Ultrasound',
    content: `<h2>ABDOMINAL ULTRASOUND</h2>
<p><strong>Findings:</strong></p>
<table>
<tr><th>Organ</th><th>Findings</th></tr>
<tr><td>Liver</td><td>Normal size, contour, and echogenicity. No focal lesion.</td></tr>
<tr><td>Gallbladder</td><td>No stones or wall thickening.</td></tr>
<tr><td>Pancreas</td><td>Normal appearance.</td></tr>
<tr><td>Spleen</td><td>Normal size and echogenicity.</td></tr>
<tr><td>Kidneys</td><td>Normal size bilaterally. No hydronephrosis or stones.</td></tr>
<tr><td>Bladder</td><td>Normal distension.</td></tr>
</table>
<p><strong>Impression:</strong> Normal abdominal ultrasound.</p>`
  },
  blank: {
    label: 'Blank Template',
    content: `<h2>EXAMINATION</h2>
<p><strong>Clinical Indication:</strong> </p>
<p><strong>Technique:</strong> </p>
<p><strong>Findings:</strong> </p>
<p><strong>Impression:</strong> </p>`
  }
};

export default function EditorToolbar({ editor }) {
  if (!editor) {
    return null;
  }

  const insertTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  const addRow = () => {
    editor.chain().focus().addRowAfter().run();
  };

  const deleteRow = () => {
    editor.chain().focus().deleteRow().run();
  };

  const insertTemplate = (templateKey) => {
    const template = MEDICAL_TEMPLATES[templateKey];
    if (template) {
      editor.chain().focus().setContent(template.content).run();
    }
  };

  const ToolbarButton = ({ onClick, active, disabled, children, title }) => (
    <button
      onMouseDown={(e) => {
        e.preventDefault(); // Prevent focus loss
      }}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-2 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors ${
        active ? 'bg-blue-100 text-blue-700' : 'text-gray-700'
      }`}
    >
      {children}
    </button>
  );

  const ToolbarDivider = () => <div className="w-px h-6 bg-gray-300 mx-1" />;

  return (
    <div className="bg-white border-b border-gray-300 px-4 py-2 flex flex-wrap items-center gap-1 sticky top-0 z-10 shadow-sm">
      {/* Templates Dropdown */}
      <div className="mr-2">
        <select
          onChange={(e) => {
            if (e.target.value) {
              insertTemplate(e.target.value);
              e.target.value = '';
            }
          }}
          className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          defaultValue=""
        >
          <option value="" disabled>Insert Template...</option>
          {Object.entries(MEDICAL_TEMPLATES).map(([key, template]) => (
            <option key={key} value={key}>{template.label}</option>
          ))}
        </select>
      </div>

      <ToolbarDivider />

      {/* Text Formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        title="Bold (Ctrl+B)"
      >
        <Bold size={18} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        title="Italic (Ctrl+I)"
      >
        <Italic size={18} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive('underline')}
        title="Underline (Ctrl+U)"
      >
        <Underline size={18} />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Headings */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        active={editor.isActive('heading', { level: 1 })}
        title="Heading 1"
      >
        <Heading1 size={18} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive('heading', { level: 2 })}
        title="Heading 2"
      >
        <Heading2 size={18} />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
        title="Bullet List"
      >
        <List size={18} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
        title="Numbered List"
      >
        <ListOrdered size={18} />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Alignment */}
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        active={editor.isActive({ textAlign: 'left' })}
        title="Align Left"
      >
        <AlignLeft size={18} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        active={editor.isActive({ textAlign: 'center' })}
        title="Align Center"
      >
        <AlignCenter size={18} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        active={editor.isActive({ textAlign: 'right' })}
        title="Align Right"
      >
        <AlignRight size={18} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('justify').run()}
        active={editor.isActive({ textAlign: 'justify' })}
        title="Justify"
      >
        <AlignJustify size={18} />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Table Controls */}
      <ToolbarButton
        onClick={insertTable}
        title="Insert Table"
      >
        <Table size={18} />
      </ToolbarButton>

      <ToolbarButton
        onClick={addRow}
        disabled={!editor.isActive('table')}
        title="Add Row"
      >
        <Plus size={18} />
      </ToolbarButton>

      <ToolbarButton
        onClick={deleteRow}
        disabled={!editor.isActive('table')}
        title="Delete Row"
      >
        <Minus size={18} />
      </ToolbarButton>
    </div>
  );
}
