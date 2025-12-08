"use client";

import { useState, useEffect } from "react";
import { clinicsAPI } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Building, Save, X } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Editor } from "@tinymce/tinymce-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ClinicsPage() {
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingClinic, setEditingClinic] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    nameArabic: "",
    address: "",
    phone: "",
    email: "",
    headerContent: "",
    footerContent: "",
    orthancUrl: "",
    orthancUsername: "",
    orthancPassword: "",
    isDefault: false,
  });

  useEffect(() => {
    console.log(process.env.NEXT_PUBLIC_TINYMCE_API_KEY);
    loadClinics();
  }, []);

  const loadClinics = async () => {
    try {
      setLoading(true);
      const response = await clinicsAPI.getAll();
      setClinics(response.data);
    } catch (error) {
      console.error("Failed to load clinics:", error);
      toast.error("Erreur lors du chargement des cliniques");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (clinic) => {
    setEditingClinic(clinic);
    setFormData({
      name: clinic.name,
      nameArabic: clinic.nameArabic || "",
      address: clinic.address || "",
      phone: clinic.phone || "",
      email: clinic.email || "",
      headerContent: clinic.headerContent || "",
      footerContent: clinic.footerContent || "",
      orthancUrl: clinic.orthancUrl || "",
      orthancUsername: clinic.orthancUsername || "",
      orthancPassword: "", // Don't show password
      isDefault: clinic.isDefault,
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette clinique ?")) return;

    try {
      await clinicsAPI.delete(id);
      toast.success("Clinique supprimée avec succès");
      loadClinics();
    } catch (error) {
      console.error("Failed to delete clinic:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingClinic) {
        await clinicsAPI.update(editingClinic._id, formData);
        toast.success("Clinique mise à jour avec succès");
      } else {
        await clinicsAPI.create(formData);
        toast.success("Clinique créée avec succès");
      }
      setShowModal(false);
      resetForm();
      loadClinics();
    } catch (error) {
      console.error("Failed to save clinic:", error);
      toast.error("Erreur lors de l'enregistrement");
    }
  };

  const resetForm = () => {
    setEditingClinic(null);
    setFormData({
      name: "",
      nameArabic: "",
      address: "",
      phone: "",
      email: "",
      headerContent: "",
      footerContent: "",
      orthancUrl: "",
      orthancUsername: "",
      orthancPassword: "",
      isDefault: false,
    });
  };

  // Helper to insert professional header structure
  const insertHeaderTemplate = () => {
    const template = `
      <table style="width: 100%; border-collapse: collapse; border: none; margin-bottom: 5px;">
        <tbody>
          <tr>
            <td style="width: 20%; vertical-align: middle; padding: 0;">
              <img src="https://via.placeholder.com/150" alt="Logo" width="80" height="80" />
            </td>
            <td style="width: 80%; vertical-align: middle; text-align: right; padding: 0;">
              <h2 style="margin: 0; font-size: 18pt; color: #000;">اسم العيادة بالعربية</h2>
              <h3 style="margin: 0; font-size: 14pt; color: #333; font-style: italic;">Nom de la Clinique (Français)</h3>
              <p style="margin: 0; font-size: 10pt; color: #666;">Adresse - Téléphone</p>
            </td>
          </tr>
        </tbody>
      </table>
      <hr style="border-top: 3px solid #3b82f6; margin-top: 0px;" />
    `;
    setFormData({ ...formData, headerContent: template });
    toast.success("Modèle d'en-tête inséré ! Remplacez le logo et le texte.");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Gestion des Cliniques
            </h1>
            <p className="text-gray-600 mt-2">
              Gérez les cliniques et leurs configurations Orthanc. Les en-têtes
              et pieds de page sont utilisés pour les exports PDF et Word.
            </p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus size={20} />
            Nouvelle Clinique
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clinics.map((clinic) => (
              <div
                key={clinic._id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="h-32 bg-gray-100 relative">
                  {clinic.headerImage ? (
                    <img
                      src={clinic.headerImage}
                      alt="Header"
                      className="w-full h-full object-contain p-2"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <span className="text-sm">Pas d&apos;en-tête</span>
                    </div>
                  )}
                  {clinic.isDefault && (
                    <span className="absolute top-2 right-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded-full">
                      Par défaut
                    </span>
                  )}
                </div>

                <div className="p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <Building
                      className="text-blue-600 flex-shrink-0 mt-1"
                      size={20}
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {clinic.name}
                      </h3>
                      {clinic.address && (
                        <p className="text-sm text-gray-500 truncate">
                          {clinic.address}
                        </p>
                      )}
                    </div>
                  </div>

                  {clinic.orthancUrl && (
                    <div className="mb-3 p-2 bg-blue-50 rounded text-xs">
                      <p className="text-blue-700 font-medium">
                        PACS Configuré
                      </p>
                      <p className="text-blue-600 truncate">
                        {clinic.orthancUrl}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(clinic)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <Edit size={16} />
                      Modifier
                    </button>
                    <button
                      onClick={() => handleDelete(clinic._id)}
                      className="flex items-center justify-center p-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {clinic.footerImage && (
                  <div className="h-20 bg-gray-50 border-t border-gray-100">
                    <img
                      src={clinic.footerImage}
                      alt="Footer"
                      className="w-full h-full object-contain p-2"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Modal */}
        <AnimatePresence>
          {showModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={() => setShowModal(false)}
              />
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col relative z-10"
              >
                <div className="flex justify-between items-center p-6 border-b border-gray-100 flex-shrink-0">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {editingClinic
                      ? "Modifier la clinique"
                      : "Nouvelle clinique"}
                  </h2>
                  <button
                    onClick={() => setShowModal(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                  <form
                    id="clinicForm"
                    onSubmit={handleSubmit}
                    className="space-y-8"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Basic Info Section */}
                      <div className="col-span-2 space-y-6">
                        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
                          Informations Générales
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="col-span-2 md:col-span-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Nom de la clinique *
                            </label>
                            <input
                              type="text"
                              required
                              value={formData.name}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  name: e.target.value,
                                })
                              }
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                              placeholder="Ex: Cabinet d'Imagerie Médicale"
                            />
                          </div>

                          <div className="col-span-2 md:col-span-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Nom en arabe
                            </label>
                            <input
                              type="text"
                              value={formData.nameArabic}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  nameArabic: e.target.value,
                                })
                              }
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                              placeholder="عيادة التصوير الطبي"
                              dir="rtl"
                            />
                          </div>

                          <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Adresse
                            </label>
                            <input
                              type="text"
                              value={formData.address}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  address: e.target.value,
                                })
                              }
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Téléphone
                            </label>
                            <input
                              type="text"
                              value={formData.phone}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  phone: e.target.value,
                                })
                              }
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Email
                            </label>
                            <input
                              type="email"
                              value={formData.email}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  email: e.target.value,
                                })
                              }
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                            />
                          </div>
                        </div>
                      </div>

                      {/* PACS Configuration */}
                      <div className="col-span-2 space-y-6">
                        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
                          Configuration PACS (Orthanc)
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-6 rounded-xl border border-gray-200">
                          <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              URL du Serveur Orthanc
                            </label>
                            <input
                              type="url"
                              placeholder="http://localhost:8042"
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                              value={formData.orthancUrl || ""}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  orthancUrl: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Nom d&apos;utilisateur
                            </label>
                            <input
                              type="text"
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                              value={formData.orthancUsername || ""}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  orthancUsername: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Mot de passe
                            </label>
                            <input
                              type="password"
                              placeholder={
                                editingClinic
                                  ? "Laisser vide pour ne pas changer"
                                  : ""
                              }
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                              value={formData.orthancPassword || ""}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  orthancPassword: e.target.value,
                                })
                              }
                            />
                          </div>
                        </div>
                      </div>

                      {/* Document Templates */}
                      <div className="col-span-2 space-y-6">
                        <div className="flex items-center justify-between border-b pb-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            Modèles de Documents
                          </h3>
                          <p className="text-sm text-gray-500">
                            Supporte texte riche, images et tableaux
                          </p>
                        </div>

                        <div className="space-y-6">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="block text-sm font-medium text-gray-700">
                                En-tête du document
                              </label>
                              <button
                                type="button"
                                onClick={insertHeaderTemplate}
                                className="text-xs flex items-center gap-1 bg-blue-50 text-blue-600 px-3 py-1 rounded border border-blue-200 hover:bg-blue-100 transition-colors"
                              >
                                <Plus size={14} />
                                Insérer Modèle (Logo + Texte)
                              </button>
                            </div>
                            <div className="border border-gray-300 rounded-lg overflow-hidden shadow-sm">
                              <Editor
                                apiKey="7mgvf74u3dfwid10bz5p3adsqja2xpm3dw0xrwwe3wua1oi0"
                                value={formData.headerContent}
                                onEditorChange={(content) =>
                                  setFormData({
                                    ...formData,
                                    headerContent: content,
                                  })
                                }
                                init={{
                                  height: 500,
                                  menubar: true,
                                  plugins: [
                                    "advlist",
                                    "autolink",
                                    "lists",
                                    "link",
                                    "image",
                                    "charmap",
                                    "preview",
                                    "anchor",
                                    "searchreplace",
                                    "visualblocks",
                                    "code",
                                    "fullscreen",
                                    "insertdatetime",
                                    "media",
                                    "table",
                                    "code",
                                    "help",
                                    "wordcount",
                                    "save",
                                    "directionality",
                                    "emoticons",
                                  ],
                                  toolbar:
                                    "undo redo | blocks | " +
                                    "bold italic forecolor backcolor | alignleft aligncenter " +
                                    "alignright alignjustify | bullist numlist outdent indent | " +
                                    "table image media | removeformat | help",
                                  content_style:
                                    "body { font-family:Helvetica,Arial,sans-serif; font-size:14px }",
                                  branding: false,
                                  resize: false,
                                  statusbar: true,
                                }}
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Pied de page du document
                            </label>
                            <div className="border border-gray-300 rounded-lg overflow-hidden shadow-sm">
                              <Editor
                                apiKey="7mgvf74u3dfwid10bz5p3adsqja2xpm3dw0xrwwe3wua1oi0"
                                value={formData.footerContent}
                                onEditorChange={(content) =>
                                  setFormData({
                                    ...formData,
                                    footerContent: content,
                                  })
                                }
                                init={{
                                  height: 200,
                                  menubar: true,
                                  plugins: [
                                    "advlist",
                                    "autolink",
                                    "lists",
                                    "link",
                                    "image",
                                    "charmap",
                                    "preview",
                                    "anchor",
                                    "searchreplace",
                                    "visualblocks",
                                    "code",
                                    "fullscreen",
                                    "insertdatetime",
                                    "media",
                                    "table",
                                    "code",
                                    "help",
                                    "wordcount",
                                    "save",
                                    "directionality",
                                    "emoticons",
                                  ],
                                  toolbar:
                                    "undo redo | blocks | " +
                                    "bold italic forecolor backcolor | alignleft aligncenter " +
                                    "alignright alignjustify | bullist numlist outdent indent | " +
                                    "table image media | removeformat | help",
                                  content_style:
                                    "body { font-family:Helvetica,Arial,sans-serif; font-size:14px }",
                                  branding: false,
                                  resize: false,
                                  statusbar: true,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="col-span-2 bg-blue-50 p-4 rounded-lg border border-blue-100">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.isDefault}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                isDefault: e.target.checked,
                              })
                            }
                            className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 transition-colors"
                          />
                          <span className="font-medium text-gray-900">
                            Définir comme clinique par défaut
                          </span>
                        </label>
                        <p className="text-sm text-gray-600 mt-1 ml-8">
                          Cette clinique sera sélectionnée automatiquement pour
                          les nouveaux utilisateurs
                        </p>
                      </div>
                    </div>
                  </form>
                </div>

                <div className="flex justify-end gap-3 p-6 border-t border-gray-100 bg-gray-50 rounded-b-xl flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors shadow-sm"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    form="clinicForm"
                    className="px-6 py-2.5 text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium transition-colors shadow-sm"
                  >
                    <Save size={18} />
                    Enregistrer
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
