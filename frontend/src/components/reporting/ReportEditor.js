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
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import EditorToolbar from './EditorToolbar';
import { useState, useEffect, useCallback, useRef } from 'react';

export default function ReportEditor({ initialContent, onChange }) {
  const [grammarSuggestions, setGrammarSuggestions] = useState([]);
  const [isCheckingGrammar, setIsCheckingGrammar] = useState(false);
  const [currentSuggestion, setCurrentSuggestion] = useState(null);
  const [showIssuesPanel, setShowIssuesPanel] = useState(false);
  const editorRef = useRef(null);

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
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Typography,
      Placeholder.configure({
        placeholder: 'Write your findings here...',
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      GhostTextExtension,
    ],
    content: initialContent || '',
    editorProps: {
      attributes: {
        spellcheck: 'true',
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[29.7cm] p-8',
      },
      handleKeyDown: (view, event) => {
        // Handle Tab key for accepting inline suggestion
        if (event.key === 'Tab' && currentSuggestion) {
          event.preventDefault();
          event.stopPropagation();
          acceptSuggestion();
          return true;
        }
        // Clear suggestion on Escape
        if (event.key === 'Escape' && currentSuggestion) {
          event.preventDefault();
          setCurrentSuggestion(null);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      if (onChange) {
        onChange(editor.getHTML());
      }
      // Debounce grammar check
      debouncedGrammarCheck(editor.getText(), editor.state.selection.from);
    },
    onSelectionUpdate: ({ editor }) => {
      // Clear suggestion when cursor moves
      if (currentSuggestion) {
        const cursorPos = editor.state.selection.from;
        if (cursorPos !== currentSuggestion.from) {
          setCurrentSuggestion(null);
        }
      }
    },
  });

  // Accept the suggestion
  const acceptSuggestion = useCallback(() => {
    if (!editor || !currentSuggestion) return;

    const { replacement, originalFrom, originalTo } = currentSuggestion;
    
    // Clean the replacement text - remove newlines and extra spaces
    const cleanedReplacement = replacement.replace(/\n/g, '').trim();
    
    // Delete the original misspelled word and insert the corrected one
    editor.chain().focus().deleteRange({ from: originalFrom, to: originalTo }).insertContentAt(originalFrom, cleanedReplacement + ' ').run();
    setCurrentSuggestion(null);
  }, [editor, currentSuggestion]);

  // Grammar checking using LanguageTool API
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
          language: 'en-US',
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
            // Complete replacement
            ghostText = replacement;
          }

          setCurrentSuggestion({
            from: nearestError.offset + nearestError.length,
            to: nearestError.offset + nearestError.length,
            originalFrom: nearestError.offset,
            originalTo: nearestError.offset + nearestError.length,
            replacement: replacement,
            ghostText: ghostText,
            message: nearestError.message,
          });
        } else {
          setCurrentSuggestion(null);
        }
      }
    } catch (error) {
      console.error('Grammar check error:', error);
    } finally {
      setIsCheckingGrammar(false);
    }
  }, []);

  // Debounce function
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

  return (
    <div className="h-full flex flex-col bg-gray-100">
      <EditorToolbar editor={editor} />
      
      <div className="flex-1 overflow-y-auto p-8 relative">
        <div className="max-w-[21cm] mx-auto bg-white shadow-2xl relative rounded-lg" >
          <EditorContent editor={editor} ref={editorRef} />
        </div>
        
        {/* Subtle hint when suggestion is active */}
        {currentSuggestion && (
          <div className="fixed bottom-4 right-4 bg-gray-900 bg-opacity-90 text-white px-3 py-2 rounded-lg shadow-lg text-xs flex items-center space-x-2 z-50 backdrop-blur-sm">
            <span className="text-gray-400">{currentSuggestion.message}</span>
            <kbd className="bg-gray-700 px-2 py-0.5 rounded text-xs border border-gray-600 font-mono">Tab</kbd>
          </div>
        )}
        
        {/* Subtle Grammar Count Indicator - now clickable */}
        {grammarSuggestions.length > 0 && (
          <button
            onClick={() => setShowIssuesPanel(!showIssuesPanel)}
            className="fixed bottom-4 left-4 bg-yellow-100 border border-yellow-300 text-yellow-800 px-3 py-2 rounded-lg shadow-md text-xs flex items-center space-x-2 hover:bg-yellow-200 transition-colors cursor-pointer"
          >
            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
            <span>{grammarSuggestions.length} issue{grammarSuggestions.length > 1 ? 's' : ''}</span>
          </button>
        )}

        {/* Issues Panel */}
        {showIssuesPanel && grammarSuggestions.length > 0 && (
          <div className="fixed bottom-16 left-4 bg-white border border-gray-300 rounded-lg shadow-xl max-w-md w-80 max-h-96 overflow-y-auto z-50">
            <div className="sticky top-0 bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 text-sm">Grammar Issues</h3>
              <button
                onClick={() => setShowIssuesPanel(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="divide-y divide-gray-200">
              {grammarSuggestions.map((issue, index) => (
                <div
                  key={index}
                  className="p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => {
                    // Jump to error location
                    if (editor) {
                      editor.commands.focus();
                      editor.commands.setTextSelection(issue.offset);
                    }
                  }}
                >
                  <div className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full mt-1.5 flex-shrink-0"></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-600 mb-1">{issue.message}</p>
                      <div className="flex items-center space-x-2 text-xs">
                        <span className="text-red-600 font-mono bg-red-50 px-1.5 py-0.5 rounded">
                          {issue.context?.text ? 
                            issue.context.text.substring(issue.context.offset, issue.context.offset + issue.context.length) :
                            'Error text'
                          }
                        </span>
                        <span className="text-gray-400">→</span>
                        <span className="text-green-600 font-mono bg-green-50 px-1.5 py-0.5 rounded">
                          {issue.replacements?.[0] || 'No suggestion'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        /* A4 Paper Styling */
        .ProseMirror {
          font-family: 'Times New Roman', Times, serif;
          font-size: 14px;
          line-height: 1.6;
          color: #000;
        }

        /* Grammar error highlight */
        .grammar-error-highlight {
          background-color: rgba(255, 235, 59, 0.3);
          border-bottom: 2px dotted #f59e0b;
          border-radius: 2px;
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

        /* Table Styling - Medical Report Style */
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

        /* Focus outline */
        .ProseMirror:focus {
          outline: none;
        }

        /* Spellcheck styling */
        .ProseMirror [data-gramm="false"] {
          background-color: transparent !important;
        }
      `}</style>
    </div>
  );
}
