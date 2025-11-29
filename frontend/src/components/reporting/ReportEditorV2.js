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

// Custom Font Size Mark
const FontSize = Mark.create({
  name: 'fontSize',
  addAttributes() {
    return {
      size: {
        default: null,
        parseHTML: element => element.style.fontSize,
        renderHTML: attributes => {
          if (!attributes.size) {
            return {}
          }
          return {
            style: `font-size: ${attributes.size}`,
          }
        },
      },
    }
  },
  parseHTML() {
    return [
      {
        tag: 'span',
        getAttrs: element => {
          const hasFontSize = element.style.fontSize
          return hasFontSize ? {} : false
        },
      },
    ]
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', HTMLAttributes, 0]
  },
});
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { ChevronDown, ChevronUp } from 'lucide-react';
import EditorToolbar from './EditorToolbar';
import { useState, useEffect, useCallback, useRef } from 'react';

import { toast } from 'sonner';

export default function ReportEditorV2({ initialTechnique, initialFindings, initialConclusion, onChange, readOnly = false, onTemplateApply, templates = [] }) {
  const [grammarSuggestions, setGrammarSuggestions] = useState([]);
  const [isCheckingGrammar, setIsCheckingGrammar] = useState(false);
  const [currentSuggestion, setCurrentSuggestion] = useState(null);
  const [showIssuesPanel, setShowIssuesPanel] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState({
    technique: false,
    findings: false,
    conclusion: false
  });
  const [focusedEditor, setFocusedEditor] = useState(null);
  const techniqueRef = useRef(null);
  const findingsRef = useRef(null);
  const conclusionRef = useRef(null);

  // Custom extension for inline ghost text
  const GhostTextExtension = Extension.create({
    name: 'ghostText',

    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: new PluginKey('ghostText'),
          state: {
            init() {
              return DecorationSet.empty;
            },
            apply(tr, set) {
              if (!currentSuggestion) return DecorationSet.empty;

              const { from, ghostText, originalFrom, originalTo } = currentSuggestion;
              const decorations = [];

              // Highlight the misspelled word with yellow background
              if (originalFrom !== undefined && originalTo !== undefined) {
                const highlightDecoration = Decoration.inline(originalFrom, originalTo, {
                  class: 'grammar-error-highlight',
                });
                decorations.push(highlightDecoration);
              }

              // Add ghost text suggestion
              const ghostDecoration = Decoration.widget(from, () => {
                const span = document.createElement('span');
                span.textContent = ghostText;
                span.style.color = '#999';
                span.style.opacity = '0.5';
                span.style.fontStyle = 'italic';
                span.style.userSelect = 'none';
                span.style.pointerEvents = 'none';
                return span;
              });
              decorations.push(ghostDecoration);

              return DecorationSet.create(tr.doc, decorations);
            },
          },
          props: {
            decorations(state) {
              return this.getState(state);
            },
          },
        }),
      ];
    },
  });

  const templatesRef = useRef(templates);

  useEffect(() => {
    templatesRef.current = templates;
  }, [templates]);

  // Custom extension for trigger words
  const TriggerExtension = Extension.create({
    name: 'triggerHandler',

    addKeyboardShortcuts() {
      return {
        'Enter': ({ editor }) => {
          // Get text before cursor
          const { selection } = editor.state;
          const { $from } = selection;
          const textBefore = $from.parent.textContent.substring(0, $from.parentOffset);

          // Get the last word
          const words = textBefore.split(/\s+/);
          const lastWord = words[words.length - 1];

          const currentTemplates = templatesRef.current;

          if (lastWord && currentTemplates && currentTemplates.length > 0) {
            const matchedTemplate = currentTemplates.find(t => t.triggerWord && t.triggerWord.toLowerCase() === lastWord.toLowerCase());

            if (matchedTemplate) {
              // Delete the trigger word
              editor.commands.deleteRange({
                from: $from.pos - lastWord.length,
                to: $from.pos
              });

              // Apply the template
              if (onTemplateApply) {
                onTemplateApply(matchedTemplate);
                toast.success(`Modèle "${matchedTemplate.name}" appliqué`);
                return true; // Prevent default Enter behavior
              }
            }
          }

          return false; // Let default Enter behavior proceed
        },
      }
    },
  });

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
    GhostTextExtension,
    FontSize,
    TriggerExtension,
  ];

  const techniqueEditor = useEditor({
    extensions: [...editorExtensions, Placeholder.configure({ placeholder: 'Describe the technique used...' })],
    content: initialTechnique || '',
    editable: !readOnly,
    immediatelyRender: false, // Fix SSR hydration mismatch
    onUpdate: ({ editor }) => {
      handleContentChange();
    },
    onFocus: () => setFocusedEditor('technique'),
    onBlur: () => setFocusedEditor(null),
  });

  const findingsEditor = useEditor({
    extensions: [...editorExtensions, Placeholder.configure({ placeholder: 'Enter your findings here...' })],
    content: initialFindings || '',
    editable: !readOnly,
    immediatelyRender: false, // Fix SSR hydration mismatch
    onUpdate: ({ editor }) => {
      handleContentChange();
      const text = editor.getText();
      const cursorPos = editor.state.selection.from;
      debouncedGrammarCheck(text, cursorPos);
    },
    onFocus: () => setFocusedEditor('findings'),
    onBlur: () => setFocusedEditor(null),
  });

  const conclusionEditor = useEditor({
    extensions: [...editorExtensions, Placeholder.configure({ placeholder: 'Write your conclusion...' })],
    content: initialConclusion || '',
    editable: !readOnly,
    immediatelyRender: false, // Fix SSR hydration mismatch
    onUpdate: ({ editor }) => {
      handleContentChange();
    },
    onFocus: () => setFocusedEditor('conclusion'),
    onBlur: () => setFocusedEditor(null),
  });

  // Update editors when initial props change (e.g., when template is applied)
  useEffect(() => {
    if (techniqueEditor && initialTechnique !== undefined) {
      const currentContent = techniqueEditor.getHTML();
      if (currentContent !== initialTechnique) {
        techniqueEditor.commands.setContent(initialTechnique || '');
      }
    }
  }, [initialTechnique, techniqueEditor]);

  useEffect(() => {
    if (findingsEditor && initialFindings !== undefined) {
      const currentContent = findingsEditor.getHTML();
      if (currentContent !== initialFindings) {
        findingsEditor.commands.setContent(initialFindings || '');
      }
    }
  }, [initialFindings, findingsEditor]);

  useEffect(() => {
    if (conclusionEditor && initialConclusion !== undefined) {
      const currentContent = conclusionEditor.getHTML();
      if (currentContent !== initialConclusion) {
        conclusionEditor.commands.setContent(initialConclusion || '');
      }
    }
  }, [initialConclusion, conclusionEditor]);

  const handleContentChange = () => {
    if (onChange && techniqueEditor && findingsEditor && conclusionEditor) {
      onChange({
        technique: techniqueEditor.getHTML(),
        findings: findingsEditor.getHTML(),
        conclusion: conclusionEditor.getHTML(),
      });
    }
  };

  // Grammar checking using LanguageTool API for French
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
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          text: text,
          language: 'fr', // French language
          enabledOnly: 'false',
        }),
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

      // Show inline suggestion for error at or near cursor
      if (suggestions.length > 0 && cursorPos !== null && cursorPos !== undefined) {
        const nearestError = suggestions.find(s =>
          Math.abs(s.offset + s.length - cursorPos) <= 5 &&
          s.replacements.length > 0
        );

        if (nearestError) {
          // Calculate ghost text (only the part to add after the error)
          const errorText = nearestError.errorText;
          const replacement = nearestError.replacements[0];

          // If the replacement starts with the error text, show only the additional part
          let ghostText;
          if (replacement.toLowerCase().startsWith(errorText.toLowerCase())) {
            ghostText = replacement.substring(errorText.length);
          } else {
            ghostText = replacement;
          }

          setCurrentSuggestion({
            position: nearestError.offset + nearestError.length,
            text: ghostText,
            fullReplacement: replacement,
            originalError: nearestError
          });
        } else {
          setCurrentSuggestion(null);
        }
      } else {
        setCurrentSuggestion(null);
      }

    } catch (error) {
      console.error('Erreur de vérification grammaticale:', error);
      setGrammarSuggestions([]);
      setCurrentSuggestion(null);
    } finally {
      setIsCheckingGrammar(false);
    }
  }, []);

  const debouncedGrammarCheck = useCallback(
    debounce((text, cursorPos) => checkGrammar(text, cursorPos), 2000),
    [checkGrammar]
  );

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  const handleTemplateApply = async (template) => {
    if (techniqueEditor && findingsEditor && conclusionEditor) {
      // Set content for each editor
      if (template.technique) {
        techniqueEditor.commands.setContent(template.technique);
      }
      if (template.findings) {
        findingsEditor.commands.setContent(template.findings);
      }
      if (template.conclusion) {
        conclusionEditor.commands.setContent(template.conclusion);
      }

      // Trigger onChange to update parent state
      handleContentChange();

      // Call parent's onTemplateApply if provided
      if (onTemplateApply) {
        await onTemplateApply(template);
      }
    }
  };

  const toggleSection = (section) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  return (
    <div className="h-full flex flex-col bg-gray-100">
      {readOnly && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-3">
          <p className="text-sm text-yellow-800 font-medium">
            Mode Lecture Seule - Vous consultez ce rapport en tant que VISUALISEUR
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-8 relative">
        <div className="max-w-[21cm] mx-auto space-y-6">
          {/* Technique Section - Floating Box */}
          <div className={`bg-white shadow-lg rounded-lg overflow-hidden transition-all duration-200 ${focusedEditor === 'technique' ? 'ring-2 ring-blue-500 border-l-4 border-blue-500' : 'border border-gray-200 border-l-4 border-blue-300'
            }`}>
            <button
              onClick={() => toggleSection('technique')}
              className="w-full px-6 py-3 flex items-center justify-between hover:bg-blue-50 transition-colors"
            >
              <h3 className="text-sm font-bold text-blue-700 uppercase flex items-center">
                <span className="bg-blue-100 px-3 py-1 rounded">Technique</span>
              </h3>
              {collapsedSections.technique ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
            </button>
            {!collapsedSections.technique && (
              <>
                {!readOnly && <EditorToolbar editor={techniqueEditor} hideTemplates={true} />}
                <div className="min-h-[120px]">
                  <EditorContent editor={techniqueEditor} ref={techniqueRef} />
                </div>
              </>
            )}
          </div>

          {/* Findings Section - Main Content */}
          <div className={`bg-white shadow-lg rounded-lg overflow-hidden transition-all duration-200 ${focusedEditor === 'findings' ? 'ring-2 ring-gray-400 border-l-4 border-gray-500' : 'border border-gray-200'
            }`}>
            <button
              onClick={() => toggleSection('findings')}
              className="w-full px-6 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <h3 className="text-sm font-bold text-gray-700 uppercase flex items-center">
                <span className="bg-gray-100 px-3 py-1 rounded">Constatations</span>
              </h3>
              {collapsedSections.findings ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
            </button>
            {!collapsedSections.findings && (
              <>
                {!readOnly && <EditorToolbar editor={findingsEditor} hideTemplates={true} />}
                <div className="rounded-none h-full">
                  <EditorContent editor={findingsEditor} ref={findingsRef} />
                </div>
              </>
            )}
          </div>

          {/* Conclusion Section - Floating Box */}
          <div className={`bg-white shadow-lg rounded-lg overflow-hidden transition-all duration-200 ${focusedEditor === 'conclusion' ? 'ring-2 ring-green-500 border-l-4 border-green-500' : 'border border-gray-200 border-l-4 border-green-300'
            }`}>
            <button
              onClick={() => toggleSection('conclusion')}
              className="w-full px-6 py-3 flex items-center justify-between hover:bg-green-50 transition-colors"
            >
              <h3 className="text-sm font-bold text-green-700 uppercase flex items-center">
                <span className="bg-green-100 px-3 py-1 rounded">Conclusion</span>
              </h3>
              {collapsedSections.conclusion ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
            </button>
            {!collapsedSections.conclusion && (
              <>
                {!readOnly && <EditorToolbar editor={conclusionEditor} hideTemplates={true} />}
                <div className="rounded-none h-full">
                  <EditorContent editor={conclusionEditor} ref={conclusionRef} />
                </div>
              </>
            )}
          </div>
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

        /* Placeholder */
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #adb5bd;
          pointer-events: none;
          height: 0;
        }

        .ProseMirror:focus {
          outline: none;
        }
      `}</style>
    </div>
  );
}
