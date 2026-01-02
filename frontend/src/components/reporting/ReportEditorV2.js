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
import { Extension, Mark } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { ChevronDown, ChevronUp, ZoomIn, ZoomOut } from 'lucide-react';
import EditorToolbar from './EditorToolbar';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { toast } from 'sonner';

// Custom Font Size Mark
const FontSize = Mark.create({
  name: 'fontSize',
  addAttributes() {
    return {
      size: {
        default: null,
        parseHTML: element => element.style.fontSize,
        renderHTML: attributes => {
          if (!attributes.size) return {};
          return { style: `font-size: ${attributes.size}` };
        },
      },
    }
  },
  parseHTML() {
    return [{ tag: 'span', getAttrs: element => element.style.fontSize ? {} : false }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', HTMLAttributes, 0];
  },
});

export default function ReportEditorV2({
  initialTechnique,
  initialFindings,
  initialConclusion,
  onChange,
  readOnly = false,
  onTemplateApply,
  templates = []
}) {
  const [grammarSuggestions, setGrammarSuggestions] = useState([]);
  const [isCheckingGrammar, setIsCheckingGrammar] = useState(false);
  const [currentSuggestion, setCurrentSuggestion] = useState(null);
  const [collapsedSections, setCollapsedSections] = useState({
    technique: false,
    findings: false,
    conclusion: false
  });
  const [zoomLevels, setZoomLevels] = useState({ technique: 1, findings: 1, conclusion: 1 });
  const [focusedEditor, setFocusedEditor] = useState(null);

  const techniqueRef = useRef(null);
  const findingsRef = useRef(null);
  const conclusionRef = useRef(null);

  // Keep a fresh reference to templates
  const templatesRef = useRef(templates);
  useEffect(() => {
    templatesRef.current = templates;
  }, [templates]);

  // --- LOGIC: Handle Trigger Words ---
  const handleTriggerLogic = (editor) => {
    if (readOnly) return false;

    const { selection } = editor.state;
    const { $from } = selection;

    // Get text before cursor
    const textBefore = $from.parent.textContent.substring(0, $from.parentOffset);
    if (!textBefore) return false;

    // Get the last word typed
    const words = textBefore.split(/\s+/);
    const lastWord = words[words.length - 1];

    if (!lastWord) return false;

    // Check against templates
    const currentTemplates = templatesRef.current;
    if (!currentTemplates || currentTemplates.length === 0) return false;

    const matchedTemplate = currentTemplates.find(t =>
      t.triggerWord &&
      t.triggerWord.trim() !== '' &&
      t.triggerWord.trim().toLowerCase() === lastWord.toLowerCase()
    );

    if (matchedTemplate) {
      // 1. Delete the trigger word
      editor.commands.deleteRange({
        from: $from.pos - lastWord.length,
        to: $from.pos
      });

      // 2. Apply Template
      if (onTemplateApply) {
        onTemplateApply(matchedTemplate);
        // Feedback to user
        toast.success(`Raccourci détecté: "${matchedTemplate.triggerWord}" remplacé par le modèle "${matchedTemplate.name}"`);
        return true; // Stop default event
      }
    }
    return false; // Allow default event
  };

  // --- EXTENSIONS ---

  const GhostTextExtension = useMemo(() => Extension.create({
    name: 'ghostText',
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: new PluginKey('ghostText'),
          state: {
            init() { return DecorationSet.empty; },
            apply(tr, set) {
              if (!currentSuggestion) return DecorationSet.empty;
              const { from, ghostText, originalFrom, originalTo } = currentSuggestion;
              const decorations = [];
              if (originalFrom !== undefined && originalTo !== undefined) {
                decorations.push(Decoration.inline(originalFrom, originalTo, { class: 'grammar-error-highlight' }));
              }
              decorations.push(Decoration.widget(from, () => {
                const span = document.createElement('span');
                span.textContent = ghostText;
                span.style.color = '#999';
                span.style.opacity = '0.5';
                span.style.fontStyle = 'italic';
                span.style.pointerEvents = 'none';
                return span;
              }));
              return DecorationSet.create(tr.doc, decorations);
            },
          },
          props: { decorations(state) { return this.getState(state); } },
        }),
      ];
    },
  }), [currentSuggestion]);

  // Corrected Trigger Extension using the local function
  const TriggerExtension = useMemo(() => Extension.create({
    name: 'triggerHandler',
    addKeyboardShortcuts() {
      return {
        'Enter': ({ editor }) => handleTriggerLogic(editor),
        'Tab': ({ editor }) => handleTriggerLogic(editor),
      }
    },
  }), []); // Empty dependency array as handleTriggerLogic uses ref

  const editorExtensions = [
    StarterKit,
    Underline,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Typography,
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    GhostTextExtension,
    FontSize,
    TriggerExtension,
  ];

  // --- EDITORS ---

  const techniqueEditor = useEditor({
    extensions: [...editorExtensions, Placeholder.configure({ placeholder: 'Technique utilisée...' })],
    content: initialTechnique || '',
    editable: !readOnly,
    immediatelyRender: false,
    onUpdate: () => handleContentChange(),
    onFocus: () => setFocusedEditor('technique'),
    onBlur: () => setFocusedEditor(null),
  });

  const findingsEditor = useEditor({
    extensions: [...editorExtensions, Placeholder.configure({ placeholder: 'Vos constatations...' })],
    content: initialFindings || '',
    editable: !readOnly,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      handleContentChange();
      debouncedGrammarCheck(editor.getText(), editor.state.selection.from);
    },
    onFocus: () => setFocusedEditor('findings'),
    onBlur: () => setFocusedEditor(null),
  });

  const conclusionEditor = useEditor({
    extensions: [...editorExtensions, Placeholder.configure({ placeholder: 'Conclusion...' })],
    content: initialConclusion || '',
    editable: !readOnly,
    immediatelyRender: false,
    onUpdate: () => handleContentChange(),
    onFocus: () => setFocusedEditor('conclusion'),
    onBlur: () => setFocusedEditor(null),
  });

  // --- SYNC EFFECTS ---
  useEffect(() => {
    if (techniqueEditor && initialTechnique !== undefined && techniqueEditor.getHTML() !== initialTechnique) {
      techniqueEditor.commands.setContent(initialTechnique || '');
    }
  }, [initialTechnique, techniqueEditor]);

  useEffect(() => {
    if (findingsEditor && initialFindings !== undefined && findingsEditor.getHTML() !== initialFindings) {
      findingsEditor.commands.setContent(initialFindings || '');
    }
  }, [initialFindings, findingsEditor]);

  useEffect(() => {
    if (conclusionEditor && initialConclusion !== undefined && conclusionEditor.getHTML() !== initialConclusion) {
      conclusionEditor.commands.setContent(initialConclusion || '');
    }
  }, [initialConclusion, conclusionEditor]);

  // --- HELPERS ---
  const handleContentChange = () => {
    if (onChange && techniqueEditor && findingsEditor && conclusionEditor) {
      onChange({
        technique: techniqueEditor.getHTML(),
        findings: findingsEditor.getHTML(),
        conclusion: conclusionEditor.getHTML(),
      });
    }
  };

  const checkGrammar = useCallback(async (text, cursorPos) => {
    if (!text || text.trim().length < 10) {
      setGrammarSuggestions([]);
      setCurrentSuggestion(null);
      return;
    }
    setIsCheckingGrammar(true);
    try {
      const response = await fetch('https://api.languagetool.org/v2/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ text, language: 'fr', enabledOnly: 'false' }),
      });
      const data = await response.json();
      const suggestions = data.matches.map(match => ({
        message: match.message,
        offset: match.offset,
        length: match.length,
        errorText: text.substring(match.offset, match.offset + match.length),
        replacements: match.replacements.slice(0, 3).map(r => r.value),
        rule: match.rule.category.name,
      }));
      setGrammarSuggestions(suggestions);

      if (suggestions.length > 0 && cursorPos !== null) {
        const nearestError = suggestions.find(s => Math.abs(s.offset + s.length - cursorPos) <= 5 && s.replacements.length > 0);
        if (nearestError) {
          const errorText = nearestError.errorText;
          const replacement = nearestError.replacements[0];
          const ghostText = replacement.toLowerCase().startsWith(errorText.toLowerCase())
            ? replacement.substring(errorText.length)
            : replacement;

          setCurrentSuggestion({
            position: nearestError.offset + nearestError.length,
            text: ghostText,
            fullReplacement: replacement,
            originalError: nearestError,
            from: nearestError.offset + nearestError.length, // Added specifically for plugin
            originalFrom: nearestError.offset,
            originalTo: nearestError.offset + nearestError.length
          });
        } else {
          setCurrentSuggestion(null);
        }
      } else {
        setCurrentSuggestion(null);
      }
    } catch (error) {
      console.error('Grammar check error:', error);
    } finally {
      setIsCheckingGrammar(false);
    }
  }, []);

  const debouncedGrammarCheck = useCallback(debounce((text, pos) => checkGrammar(text, pos), 2000), [checkGrammar]);

  function debounce(func, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  const toggleSection = (section) => setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));



  const adjustZoom = (section, delta) => {
    setZoomLevels(prev => ({
      ...prev,
      [section]: Math.min(Math.max(0.8, prev[section] + delta), 1.5)
    }));
  };

  return (
    <div className="h-full flex flex-col bg-gray-100">
      {readOnly && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-3">
          <p className="text-sm text-yellow-800 font-medium">Mode Lecture Seule</p>
        </div>
      )}
      <div className="flex-1 p-4 h-full overflow-y-auto">
        <div className="w-full flex flex-col items-center space-y-6 pb-20">

          {/* Technique */}
          <div
            style={{ zoom: zoomLevels.technique, width: '21cm', maxWidth: '100%' }}
            className={`bg-white shadow-lg rounded-lg overflow-hidden transition-all duration-200 flex flex-col ${focusedEditor === 'technique' ? 'ring-2 ring-blue-500 border-l-4 border-blue-500' : 'border border-gray-200 border-l-4 border-blue-300'
              }`}>
            <div className="flex-shrink-0 w-full px-6 py-3 flex items-center justify-between hover:bg-blue-50 transition-colors bg-white border-b border-gray-100">
              <button onClick={() => toggleSection('technique')} className="flex items-center space-x-3 flex-1">
                {collapsedSections.technique ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                <h3 className="text-sm font-bold text-blue-700 uppercase"><span className="bg-blue-100 px-3 py-1 rounded">Technique</span></h3>
              </button>
              <div className="flex items-center space-x-2">
                <div className="flex items-center bg-blue-50 rounded-lg p-0.5 border border-blue-100">
                  <button
                    onClick={(e) => { e.stopPropagation(); adjustZoom('technique', -0.1); }}
                    className="p-1 hover:bg-white rounded shadow-sm text-blue-600 transition-all disabled:opacity-50"
                    disabled={zoomLevels.technique <= 0.8}
                    title="Zoom Arrière"
                  >
                    <ZoomOut size={14} />
                  </button>
                  <span className="text-xs font-medium text-blue-700 w-8 text-center">{Math.round(zoomLevels.technique * 100)}%</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); adjustZoom('technique', 0.1); }}
                    className="p-1 hover:bg-white rounded shadow-sm text-blue-600 transition-all disabled:opacity-50"
                    disabled={zoomLevels.technique >= 1.5}
                    title="Zoom Avant"
                  >
                    <ZoomIn size={14} />
                  </button>
                </div>
              </div>
            </div>
            {!collapsedSections.technique && (
              <div className="flex-1 flex flex-col min-h-0 transition-transform duration-200">
                {!readOnly && <EditorToolbar editor={techniqueEditor} hideTemplates={true} />}
                <div className="flex-1 overflow-y-auto min-h-[150px]"><EditorContent editor={techniqueEditor} ref={techniqueRef} /></div>
              </div>
            )}
          </div>

          {/* Findings */}
          <div
            style={{ zoom: zoomLevels.findings, width: '21cm', maxWidth: '100%' }}
            className={`bg-white shadow-lg rounded-lg overflow-hidden transition-all duration-200 flex flex-col ${focusedEditor === 'findings' ? 'ring-2 ring-gray-400 border-l-4 border-gray-500' : 'border border-gray-200'
              }`}>
            <div className="flex-shrink-0 w-full px-6 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors bg-white border-b border-gray-100">
              <button onClick={() => toggleSection('findings')} className="flex items-center space-x-3 flex-1">
                {collapsedSections.findings ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                <h3 className="text-sm font-bold text-gray-700 uppercase"><span className="bg-gray-100 px-3 py-1 rounded">Constatations</span></h3>
              </button>
              <div className="flex items-center space-x-2">
                <div className="flex items-center bg-gray-100 rounded-lg p-0.5 border border-gray-200">
                  <button
                    onClick={(e) => { e.stopPropagation(); adjustZoom('findings', -0.1); }}
                    className="p-1 hover:bg-white rounded shadow-sm text-gray-600 transition-all disabled:opacity-50"
                    disabled={zoomLevels.findings <= 0.8}
                    title="Zoom Arrière"
                  >
                    <ZoomOut size={14} />
                  </button>
                  <span className="text-xs font-medium text-gray-700 w-8 text-center">{Math.round(zoomLevels.findings * 100)}%</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); adjustZoom('findings', 0.1); }}
                    className="p-1 hover:bg-white rounded shadow-sm text-gray-600 transition-all disabled:opacity-50"
                    disabled={zoomLevels.findings >= 1.5}
                    title="Zoom Avant"
                  >
                    <ZoomIn size={14} />
                  </button>
                </div>
              </div>
            </div>
            {!collapsedSections.findings && (
              <div className="flex-1 flex flex-col min-h-0 transition-transform duration-200">
                {!readOnly && <EditorToolbar editor={findingsEditor} hideTemplates={true} />}
                <div className="flex-1 overflow-y-auto min-h-[300px]"><EditorContent editor={findingsEditor} ref={findingsRef} /></div>
              </div>
            )}
          </div>

          {/* Conclusion */}
          <div
            style={{ zoom: zoomLevels.conclusion, width: '21cm', maxWidth: '100%' }}
            className={`bg-white shadow-lg rounded-lg overflow-hidden transition-all duration-200 flex flex-col ${focusedEditor === 'conclusion' ? 'ring-2 ring-green-500 border-l-4 border-green-500' : 'border border-gray-200 border-l-4 border-green-300'
              }`}>
            <div className="flex-shrink-0 w-full px-6 py-3 flex items-center justify-between hover:bg-green-50 transition-colors bg-white border-b border-gray-100">
              <button onClick={() => toggleSection('conclusion')} className="flex items-center space-x-3 flex-1">
                {collapsedSections.conclusion ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                <h3 className="text-sm font-bold text-green-700 uppercase"><span className="bg-green-100 px-3 py-1 rounded">Conclusion</span></h3>
              </button>
              <div className="flex items-center space-x-2">
                <div className="flex items-center bg-green-50 rounded-lg p-0.5 border border-green-100">
                  <button
                    onClick={(e) => { e.stopPropagation(); adjustZoom('conclusion', -0.1); }}
                    className="p-1 hover:bg-white rounded shadow-sm text-green-600 transition-all disabled:opacity-50"
                    disabled={zoomLevels.conclusion <= 0.8}
                    title="Zoom Arrière"
                  >
                    <ZoomOut size={14} />
                  </button>
                  <span className="text-xs font-medium text-green-700 w-8 text-center">{Math.round(zoomLevels.conclusion * 100)}%</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); adjustZoom('conclusion', 0.1); }}
                    className="p-1 hover:bg-white rounded shadow-sm text-green-600 transition-all disabled:opacity-50"
                    disabled={zoomLevels.conclusion >= 1.5}
                    title="Zoom Avant"
                  >
                    <ZoomIn size={14} />
                  </button>
                </div>
              </div>
            </div>
            {!collapsedSections.conclusion && (
              <div className="flex-1 flex flex-col min-h-0 transition-transform duration-200">
                {!readOnly && <EditorToolbar editor={conclusionEditor} hideTemplates={true} />}
                <div className="flex-1 overflow-y-auto min-h-[150px]"><EditorContent editor={conclusionEditor} ref={conclusionRef} /></div>
              </div>
            )}
          </div>
        </div>
      </div>
      <style jsx global>{`
        .ProseMirror { font-family: 'Times New Roman', Times, serif; font-size: 14px; line-height: 1.6; color: #000; min-height: 150px; border-radius: 0.5rem; padding: 0.5rem; }
        .ProseMirror:focus { outline: none; border: 2px solid transparent; }
        .ProseMirror h1 { font-size: 24px; font-weight: bold; margin-top: 1em; margin-bottom: 0.5em; color: #1a1a1a; }
        .ProseMirror h2 { font-size: 18px; font-weight: bold; margin-top: 0.8em; margin-bottom: 0.4em; color: #2a2a2a; }
        .ProseMirror p { margin-bottom: 0.5em; }
        .ProseMirror ul, .ProseMirror ol { padding-left: 1.5em; margin-bottom: 0.5em; }
        .ProseMirror ul { list-style-type: disc; }
        .ProseMirror ol { list-style-type: decimal; }
        .ProseMirror li { margin-bottom: 0.25em; display: list-item; }
        .ProseMirror table { border-collapse: collapse; width: 100%; margin: 1em 0; border: 1px solid #000; }
        .ProseMirror th, .ProseMirror td { border: 1px solid #000; padding: 8px 12px; text-align: left; vertical-align: top; }
        .ProseMirror th { background-color: #f0f0f0; font-weight: bold; }
        .ProseMirror p.is-editor-empty:first-child::before { content: attr(data-placeholder); float: left; color: #adb5bd; pointer-events: none; height: 0; }
        .grammar-error-highlight { background-color: rgba(255, 255, 0, 0.3); border-bottom: 2px dotted #f59e0b; }
      `}</style>
    </div>
  );
}