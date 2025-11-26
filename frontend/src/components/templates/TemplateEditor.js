'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Typography from '@tiptap/extension-typography';
import Placeholder from '@tiptap/extension-placeholder';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { useEffect, useRef } from 'react';
import TemplateEditorToolbar from './TemplateEditorToolbar';

export default function TemplateEditor({ initialTechnique, initialFindings, initialConclusion, onChange }) {
  const techniqueRef = useRef(null);
  const findingsRef = useRef(null);
  const conclusionRef = useRef(null);

  const editorExtensions = [
    StarterKit,
    Underline,
    TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),
    Typography,
    Table.configure({
      resizable: true,
    }),
    TableRow,
    TableHeader,
    TableCell,
  ];

  const techniqueEditor = useEditor({
    extensions: [...editorExtensions, Placeholder.configure({ placeholder: 'Describe the technique...' })],
    content: initialTechnique || '',
    onUpdate: ({ editor }) => {
      handleContentChange();
    },
  });

  const findingsEditor = useEditor({
    extensions: [...editorExtensions, Placeholder.configure({ placeholder: 'Enter findings template...' })],
    content: initialFindings || '',
    onUpdate: ({ editor }) => {
      handleContentChange();
    },
  });

  const conclusionEditor = useEditor({
    extensions: [...editorExtensions, Placeholder.configure({ placeholder: 'Enter conclusion template...' })],
    content: initialConclusion || '',
    onUpdate: ({ editor }) => {
      handleContentChange();
    },
  });

  const handleContentChange = () => {
    if (onChange && techniqueEditor && findingsEditor && conclusionEditor) {
      onChange({
        technique: techniqueEditor.getHTML(),
        findings: findingsEditor.getHTML(),
        conclusion: conclusionEditor.getHTML(),
      });
    }
  };

  // Update editors when initial values change
  useEffect(() => {
    if (techniqueEditor && initialTechnique !== techniqueEditor.getHTML()) {
      techniqueEditor.commands.setContent(initialTechnique || '');
    }
  }, [initialTechnique, techniqueEditor]);

  useEffect(() => {
    if (findingsEditor && initialFindings !== findingsEditor.getHTML()) {
      findingsEditor.commands.setContent(initialFindings || '');
    }
  }, [initialFindings, findingsEditor]);

  useEffect(() => {
    if (conclusionEditor && initialConclusion !== conclusionEditor.getHTML()) {
      conclusionEditor.commands.setContent(initialConclusion || '');
    }
  }, [initialConclusion, conclusionEditor]);

  return (
    <div className="space-y-6 border-0">
      {/* Technique Section - Floating Box */}
      <div className="bg-white shadow-lg rounded-lg border-l-4 border-blue-500 overflow-hidden">
        <h3 className="text-sm font-bold text-blue-700 px-6 pt-4 pb-2 uppercase flex items-center">
          <span className="bg-blue-100 px-3 py-1 rounded">Technique</span>
        </h3>
        <TemplateEditorToolbar editor={techniqueEditor} />
        <div className="rounded-none">
          <EditorContent editor={techniqueEditor} ref={techniqueRef} />
        </div>
      </div>

      {/* Findings Section - Main Content */}
      <div className="bg-white shadow-lg rounded-lg overflow-hidden">
        <h3 className="text-sm font-bold text-gray-700 px-6 pt-4 pb-2 uppercase flex items-center">
          <span className="bg-gray-100 px-3 py-1 rounded">Findings</span>
        </h3>
        <TemplateEditorToolbar editor={findingsEditor} />
        <div className="rounded-none min-h-[400px]">
          <EditorContent editor={findingsEditor} ref={findingsRef} />
        </div>
      </div>

      {/* Conclusion Section - Floating Box */}
      <div className="bg-white shadow-lg rounded-lg border-l-4 border-green-500 overflow-hidden">
        <h3 className="text-sm font-bold text-green-700 px-6 pt-4 pb-2 uppercase flex items-center">
          <span className="bg-green-100 px-3 py-1 rounded">Conclusion</span>
        </h3>
        <TemplateEditorToolbar editor={conclusionEditor} />
        <div className="rounded-none">
          <EditorContent editor={conclusionEditor} ref={conclusionRef} />
        </div>
      </div>

      <style jsx global>{`
        /* A4 Paper Styling */
        .ProseMirror {
          font-family: 'Times New Roman', Times, serif;
          font-size: 14px;
          line-height: 1.6;
          color: #000;
          min-height: 150px;
          border-radius: 0.5rem;
          padding: 0.5rem;
          outline: none;
        }
        
        .ProseMirror:focus {
          outline: none;
          border: 2px solid transparent;
        }

        .ProseMirror h1 {
          font-size: 24px;
          font-weight: bold;
          margin-top: 1em;
          margin-bottom: 0.5em;
          color: #1a1a1a;
        }

        .ProseMirror h2 {
          font-size: 18px;
          font-weight: bold;
          margin-top: 0.8em;
          margin-bottom: 0.4em;
          color: #2a2a2a;
        }

        .ProseMirror h3 {
          font-size: 16px;
          font-weight: bold;
          margin-top: 0.6em;
          margin-bottom: 0.3em;
        }

        .ProseMirror p {
          margin-bottom: 0.5em;
        }

        .ProseMirror ul,
        .ProseMirror ol {
          padding-left: 1.5em;
          margin-bottom: 0.5em;
        }

        .ProseMirror ul {
          list-style-type: disc;
        }

        .ProseMirror ol {
          list-style-type: decimal;
        }

        .ProseMirror li {
          margin-bottom: 0.25em;
          display: list-item;
        }

        .ProseMirror ul ul {
          list-style-type: circle;
        }

        .ProseMirror ul ul ul {
          list-style-type: square;
        }

        .ProseMirror strong {
          font-weight: bold;
        }

        .ProseMirror em {
          font-style: italic;
        }

        .ProseMirror u {
          text-decoration: underline;
        }

        /* Table Styling */
        .ProseMirror table {
          border-collapse: collapse;
          width: 100%;
          margin: 1em 0;
          border: 1px solid #000;
        }

        .ProseMirror th,
        .ProseMirror td {
          border: 1px solid #000;
          padding: 8px 12px;
          text-align: left;
          vertical-align: top;
        }

        .ProseMirror th {
          background-color: #f0f0f0;
          font-weight: bold;
        }

        .ProseMirror p.is-editor-empty:first-child::before {
          color: #adb5bd;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
