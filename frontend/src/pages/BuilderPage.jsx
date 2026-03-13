import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { Save, Download, Copy } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LibraryPane } from "@/components/prompt-builder/LibraryPane";
import { PreviewPane } from "@/components/prompt-builder/PreviewPane";
import { SectionCard } from "@/components/prompt-builder/SectionCard";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import {
  compilePrompt as compilePromptAPI,
  createPromptDraft,
  fetchPromptDraft,
  fetchTemplates,
  updatePromptDraft,
} from "@/lib/api";
import {
  compilePromptOutput,
  createBuilderSectionsFromTemplates,
  getMissingRequiredVariables,
  hydrateDraftSectionsFromTemplates,
} from "@/lib/promptBuilder";

const EMPTY_METADATA = {
  title: "",
  customer_name: "",
  use_case: "",
};

const BuilderPage = ({ currentUser }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [metadata, setMetadata] = useState(EMPTY_METADATA);
  const [sections, setSections] = useState([]);
  const [draftId, setDraftId] = useState("");
  const [activeVariable, setActiveVariable] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const location = useLocation();
  const navigate = useNavigate();

  const isReadOnly = currentUser?.role === "viewer";
  const compiledOutput = useMemo(() => compilePromptOutput(sections), [sections]);
  const selectedSections = useMemo(() => sections.filter((section) => section.enabled), [sections]);

  const loadBuilderState = useCallback(async () => {
    setLoading(true);
    try {
      const templates = await fetchTemplates();
      const params = new URLSearchParams(location.search);
      const draftIdFromUrl = params.get("draftId");

      if (draftIdFromUrl) {
        const draft = await fetchPromptDraft(draftIdFromUrl);
        setDraftId(draft.id);
        setMetadata({
          title: draft.title,
          customer_name: draft.customer_name,
          use_case: draft.use_case,
        });
        setSections(hydrateDraftSectionsFromTemplates(draft.sections, templates));
      } else {
        setDraftId("");
        setMetadata({
          ...EMPTY_METADATA,
          title: "Untitled Prompt",
        });
        setSections(createBuilderSectionsFromTemplates(templates));
      }
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Unable to load prompt builder workspace.");
    } finally {
      setLoading(false);
    }
  }, [location.search]);

  useEffect(() => {
    loadBuilderState();
  }, [loadBuilderState]);

  const updateSectionById = (sectionId, updatedSection) => {
    setSections((prevSections) => prevSections.map((section) => (section.id === sectionId ? updatedSection : section)));
  };

  const handleSectionToggle = (sectionId, enabled) => {
    setSections((prevSections) =>
      prevSections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              enabled,
            }
          : section,
      ),
    );
  };

  const handleSubsectionToggle = (sectionId, subsectionId, enabled) => {
    setSections((prevSections) =>
      prevSections.map((section) => {
        if (section.id !== sectionId) {
          return section;
        }

        return {
          ...section,
          subsections: section.subsections.map((subsection) =>
            subsection.id === subsectionId
              ? {
                  ...subsection,
                  enabled,
                }
              : subsection,
          ),
        };
      }),
    );
  };

  const handleMetadataChange = (field, value) => {
    if (isReadOnly) {
      return;
    }

    setMetadata((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const copyText = async (text) => {
    if (navigator?.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (error) {
        // Fallback to legacy method below.
      }
    }

    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(textArea);
      return copied;
    } catch (error) {
      return false;
    }
  };

  const handleCopyPrompt = async () => {
    const copied = await copyText(compiledOutput.compiledPrompt);
    if (copied) {
      toast.success("Compiled prompt copied.");
      return;
    }
    toast.error("Unable to copy prompt.");
  };

  const handleCopySnippets = async () => {
    const payload = JSON.stringify(compiledOutput.sectionSnippets, null, 2);
    const copied = await copyText(payload);
    if (copied) {
      toast.success("Section snippets copied as JSON.");
      return;
    }
    toast.error("Unable to copy snippets.");
  };

  const handleDownloadJson = () => {
    const payload = {
      metadata,
      sections,
      compiled_prompt: compiledOutput.compiledPrompt,
      snippets: compiledOutput.sectionSnippets,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `${(metadata.title || "prompt-draft").replace(/\s+/g, "-").toLowerCase()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
    toast.success("JSON export downloaded.");
  };

  const handleSaveDraft = async () => {
    if (isReadOnly) {
      toast.error("Viewer role has read-only access.");
      return;
    }

    const missingRequiredVariables = getMissingRequiredVariables(sections);
    if (missingRequiredVariables.length > 0) {
      const preview = missingRequiredVariables.slice(0, 3).join(" | ");
      toast.error(`Fill required fields before saving. Missing: ${preview}`);
      return;
    }

    setSaving(true);
    try {
      const serverCompiled = await compilePromptAPI(sections);
      const payload = {
        ...metadata,
        sections,
        compiled_prompt: serverCompiled.compiled_prompt,
      };

      if (draftId) {
        const updated = await updatePromptDraft(draftId, payload);
        setDraftId(updated.id);
        toast.success("Draft updated successfully.");
        return;
      }

      const created = await createPromptDraft(payload);
      setDraftId(created.id);
      const params = new URLSearchParams(location.search);
      params.set("draftId", created.id);
      navigate(`/builder?${params.toString()}`, { replace: true });
      toast.success("Draft saved successfully.");
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Unable to save draft right now.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-84px)] items-center justify-center" data-testid="builder-loading-state">
        <p className="text-base font-semibold text-slate-700">Loading builder workspace...</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-84px)] flex-col" data-testid="builder-page-container">
      <div
        className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-sm md:px-6"
        data-testid="builder-compact-header"
      >
        <div className="grid gap-3 lg:grid-cols-[1.6fr_1.2fr_1.2fr_auto]" data-testid="builder-compact-header-grid">
          <Input
            value={metadata.title}
            disabled={isReadOnly}
            onChange={(event) => handleMetadataChange("title", event.target.value)}
            placeholder="Prompt title"
            data-testid="builder-compact-title-input"
          />
          <Input
            value={metadata.customer_name}
            disabled={isReadOnly}
            onChange={(event) => handleMetadataChange("customer_name", event.target.value)}
            placeholder="Customer"
            data-testid="builder-compact-customer-input"
          />
          <Input
            value={metadata.use_case}
            disabled={isReadOnly}
            onChange={(event) => handleMetadataChange("use_case", event.target.value)}
            placeholder="Use case"
            data-testid="builder-compact-usecase-input"
          />
          <Button
            type="button"
            onClick={handleSaveDraft}
            disabled={saving || isReadOnly}
            data-testid="builder-save-draft-button"
          >
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save Draft"}
          </Button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2" data-testid="builder-compact-header-badges">
          <Badge className="bg-indigo-100 text-indigo-700" data-testid="builder-role-badge">
            Role: {currentUser?.role}
          </Badge>
          <Badge className="bg-slate-100 text-slate-700" data-testid="builder-draft-id-badge">
            Draft: {draftId || "New"}
          </Badge>
        </div>
      </div>

      <div className="min-h-0 flex-1" data-testid="builder-resizable-container">
        <ResizablePanelGroup direction="horizontal" autoSaveId="builder-three-pane-layout" data-testid="builder-resizable-group">
          <ResizablePanel defaultSize={25} minSize={18} data-testid="builder-library-panel">
            <section className="pane-scroll h-full overflow-y-auto border-r border-slate-200 bg-slate-50/70 p-5" data-testid="builder-library-pane">
              <LibraryPane
                sections={sections}
                readOnly={isReadOnly}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onSectionToggle={handleSectionToggle}
                onSubsectionToggle={handleSubsectionToggle}
              />
            </section>
          </ResizablePanel>

          <ResizableHandle withHandle data-testid="builder-library-config-resize-handle" />

          <ResizablePanel defaultSize={35} minSize={24} data-testid="builder-config-panel">
            <section className="pane-scroll h-full overflow-y-auto border-r border-slate-200 bg-white p-5" data-testid="builder-config-pane">
              <div className="space-y-6">
                <div className="flex items-center justify-between" data-testid="builder-configuration-header">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500" data-testid="builder-configuration-eyebrow">
                      Prompt Configuration
                    </p>
                    <h2 className="mt-1 text-2xl font-bold text-slate-900" data-testid="builder-configuration-title">
                      Configure Selected Sections
                    </h2>
                  </div>
                  <Badge className="bg-indigo-100 text-indigo-700" data-testid="builder-selected-sections-badge">
                    {selectedSections.length} selected
                  </Badge>
                </div>

                {selectedSections.length === 0 && (
                  <div
                    className="noise-overlay rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center"
                    data-testid="builder-configuration-empty-state"
                  >
                    <p className="text-sm font-semibold text-slate-700">No sections selected yet.</p>
                    <p className="mt-2 text-sm text-slate-600">
                      Use the left library pane to pick sections and subsections for this prompt.
                    </p>
                  </div>
                )}

                <div className="space-y-6" data-testid="builder-configured-section-stack">
                  {selectedSections.map((section, index) => (
                    <motion.div
                      key={section.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: index * 0.03 }}
                      data-testid={`builder-configured-section-motion-${section.id}`}
                    >
                      <SectionCard
                        section={section}
                        readOnly={isReadOnly}
                        activeVariable={activeVariable}
                        onActiveVariableChange={setActiveVariable}
                        onSectionUpdate={(updatedSection) => updateSectionById(section.id, updatedSection)}
                        showSectionToggle={false}
                        showSubsectionToggle={false}
                        onlyShowEnabledSubsections
                      />
                    </motion.div>
                  ))}
                </div>
              </div>
            </section>
          </ResizablePanel>

          <ResizableHandle withHandle data-testid="builder-config-preview-resize-handle" />

          <ResizablePanel defaultSize={40} minSize={25} data-testid="builder-preview-panel">
            <section className="pane-scroll h-full overflow-y-auto bg-slate-50/30 p-5" data-testid="builder-preview-pane">
              <div
                className="sticky top-0 z-10 mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/90 p-3 shadow-sm backdrop-blur-sm"
                data-testid="preview-export-toolbar"
              >
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500" data-testid="preview-export-eyebrow">
                    Output Actions
                  </p>
                  <p className="text-sm font-semibold text-slate-800" data-testid="preview-export-title">
                    Export and share compiled prompt instantly
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2" data-testid="preview-export-actions-group">
                  <Button type="button" variant="outline" onClick={handleCopyPrompt} data-testid="preview-copy-prompt-button">
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Prompt
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCopySnippets}
                    data-testid="preview-copy-snippets-button"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Snippets
                  </Button>
                  <Button type="button" onClick={handleDownloadJson} data-testid="preview-download-json-button">
                    <Download className="mr-2 h-4 w-4" />
                    Download JSON
                  </Button>
                </div>
              </div>

              <PreviewPane
                metadata={metadata}
                sections={sections}
                compiledPrompt={compiledOutput.compiledPrompt}
                activeVariable={activeVariable}
              />
            </section>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
};

export default BuilderPage;
