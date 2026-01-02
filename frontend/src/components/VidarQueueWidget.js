'use client';

import { useState, useEffect, useRef } from 'react';
import { queueAPI } from '@/lib/api';
import { Minimize2, Maximize2, X, RefreshCw, Trash2, Send, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';

export default function VidarQueueWidget() {
    const { user } = useAuth();
    const [queue, setQueue] = useState([]);
    const [isOpen, setIsOpen] = useState(false); // Start collapsed by default? Or open if active?
    const [loading, setLoading] = useState(true);
    const [hasNotified, setHasNotified] = useState(false);

    const pollInterval = useRef(null);

    useEffect(() => {
        if (user) {
            fetchQueue();
            // Start polling
            pollInterval.current = setInterval(fetchQueue, 3000);
        } else {
            setQueue([]);
            if (pollInterval.current) clearInterval(pollInterval.current);
        }

        return () => {
            if (pollInterval.current) clearInterval(pollInterval.current);
        };
    }, [user]);

    const fetchQueue = async () => {
        try {
            const response = await queueAPI.getAll();
            const newQueue = response.data || [];

            setQueue(prevQueue => {
                // Compare new queue state with old to trigger toasts if needed? 
                // For now, just simplistic check
                return newQueue;
            });
            setLoading(false);

            // Check for notification on first load
            if (!hasNotified && newQueue.length > 0) {
                const failed = newQueue.filter(i => i.status === 'FAILED').length;
                const processing = newQueue.filter(i => i.status === 'PROCESSING' || i.status === 'PENDING').length;

                if (failed > 0 || processing > 0) {
                    toast('Envoi vers Vidar', {
                        description: `Vous avez ${processing} envois en cours et ${failed} échecs.`,
                        action: {
                            label: 'Voir',
                            onClick: () => setIsOpen(true)
                        },
                        duration: 5000
                    });
                    setIsOpen(true); // Auto open if active
                }
                setHasNotified(true);
            }

        } catch (error) {
            console.error('Failed to poll queue', error);
        }
    };

    const handleRetry = async (id) => {
        try {
            await queueAPI.retry(id);
            fetchQueue();
            toast.success('Réessai lancé');
        } catch (error) {
            toast.error('Échec du réessai');
        }
    };

    const handleRemove = async (id) => {
        try {
            await queueAPI.remove(id);
            fetchQueue();
        } catch (error) {
            // ignore
        }
    };

    const handleClear = async () => {
        try {
            await queueAPI.clear();
            fetchQueue();
            toast.success('Historique effacé');
            setIsOpen(false);
        } catch (error) {
            console.error(error);
        }
    };

    if (!user || queue.length === 0) return null;

    const activeCount = queue.filter(i => ['PENDING', 'PROCESSING'].includes(i.status)).length;
    const errorCount = queue.filter(i => i.status === 'FAILED').length;

    // Render Collapsed
    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-4 z-50 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-all flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4"
            >
                {activeCount > 0 ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                {(activeCount > 0 || errorCount > 0) && (
                    <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full absolute -top-1 -right-1">
                        {activeCount + errorCount}
                    </span>
                )}
            </button>
        );
    }

    return (
        <div className="fixed bottom-4 right-4 z-50 w-80 md:w-96 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[500px] animate-in slide-in-from-right-10 duration-300">
            {/* Header */}
            <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                    {activeCount > 0 && <Loader2 className="animate-spin" size={16} />}
                    <span className="font-semibold">Envois Vidar ({activeCount})</span>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-blue-500 rounded"><Minimize2 size={16} /></button>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2 bg-gray-50 space-y-2">
                {queue.map(item => (
                    <div key={item._id} className="bg-white p-3 rounded border border-gray-200 shadow-sm text-sm relative">
                        <div className="flex justify-between items-start mb-1">
                            <span className="font-medium truncate pr-6" title={item.patientName}>{item.patientName || 'Patient inconnu'}</span>
                            <button onClick={() => handleRemove(item._id)} className="text-gray-400 hover:text-red-500 absolute top-2 right-2">
                                <X size={14} />
                            </button>
                        </div>
                        <div className="text-xs text-gray-500 mb-2 flex justify-between">
                            <span>{item.modality} • {item.description}</span>
                            <span className="font-mono">{item.targetNode}</span>
                        </div>

                        {/* Status Bar */}
                        <div className="w-full bg-gray-100 rounded-full h-1.5 mb-2 overflow-hidden">
                            <div
                                className={`h-full transition-all duration-500 ${item.status === 'FAILED' ? 'bg-red-500' :
                                        item.status === 'COMPLETED' ? 'bg-green-500' : 'bg-blue-500'
                                    }`}
                                style={{ width: `${item.status === 'COMPLETED' ? 100 : Math.max(5, item.progress)}%` }}
                            />
                        </div>

                        <div className="flex items-center justify-between text-xs">
                            <span className={`font-medium ${item.status === 'FAILED' ? 'text-red-600' :
                                    item.status === 'COMPLETED' ? 'text-green-600' : 'text-blue-600'
                                }`}>
                                {item.status === 'PENDING' && 'En attente...'}
                                {item.status === 'PROCESSING' && `Envoi... ${item.progress}%`}
                                {item.status === 'COMPLETED' && 'Terminé'}
                                {item.status === 'FAILED' && 'Échec'}
                            </span>

                            {item.status === 'FAILED' && (
                                <button
                                    onClick={() => handleRetry(item._id)}
                                    className="flex items-center gap-1 text-blue-600 hover:underline"
                                >
                                    <RefreshCw size={12} /> Réessayer
                                </button>
                            )}
                        </div>
                        {item.error && <p className="text-xs text-red-500 mt-1">{item.error}</p>}
                    </div>
                ))}

                {queue.length === 0 && (
                    <p className="text-center text-gray-400 py-4">Aucun envoi en cours</p>
                )}
            </div>

            {/* Footer */}
            {(queue.length > 0) && (
                <div className="bg-gray-50 p-2 border-t border-gray-200 flex justify-end">
                    <button
                        onClick={handleClear}
                        className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                    >
                        <Trash2 size={12} /> Effacer l'historique
                    </button>
                </div>
            )}
        </div>
    );
}
