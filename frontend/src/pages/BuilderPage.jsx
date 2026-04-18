import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { Copy, Download, RotateCcw, Save } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LibraryPane } from "@/components/prompt-builder/LibraryPane";
import { SectionCard } from "@/components/prompt-builder/SectionCard";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import {
  createPromptDraft,
  fetchPromptDraft,
  fetchReadyTemplates,
  fetchTemplateLibrary,
  updatePromptDraft,
} from "@/lib/api";
import {
  compilePromptOutput,
  createBuilderSectionsFromTemplates,
  hydrateDraftSectionsFromTemplates,
} from "@/lib/promptBuilder";

const EMPTY_METADATA = {
  title: "",
  customer_name: "",
  use_case: "",
  template_id: "",
  template_name: "",
};

const BuilderPage = ({ currentUser }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [metadata, setMetadata] = useState(EMPTY_METADATA);
  const [sections, setSections] = useState([]);
  const [draftId, setDraftId] = useState("");
  const [activeVariable, setActiveVariable] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [readyTemplates, setReadyTemplates] = useState([]);
  const [allTemplates, setAllTemplates] = useState([]);
  const [setupTemplateId, setSetupTemplateId] = useState("");
  const [setupPromptName, setSetupPromptName] = useState("");
  const [isBuilderInitialized, setIsBuilderInitialized] = useState(false);
  const [promptEditorText, setPromptEditorText] = useState("");
  const [isPromptManuallyEdited, setIsPromptManuallyEdited] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  const isReadOnly = currentUser?.role === "viewer";
  const compiledOutput = useMemo(() => compilePromptOutput(sections), [sections]);
  const selectedSections = useMemo(() => sections.filter((section) => section.enabled), [sections]);

  useEffect(() => {
    if (!isPromptManuallyEdited) {
      setPromptEditorText(compiledOutput.compiledPrompt);
    }
  }, [compiledOutput.compiledPrompt, isPromptManuallyEdited]);

  const loadBuilderState = useCallback(async () => {
    setLoading(true);
    try {
      const [templatesResponse, readyTemplatesResponse] = await Promise.all([fetchTemplateLibrary(), fetchReadyTemplates()]);
      setAllTemplates(templatesResponse);
      setReadyTemplates(readyTemplatesResponse);

      const params = new URLSearchParams(location.search);
      const draftIdFromUrl = params.get("draftId");

      if (draftIdFromUrl) {
        const draft = await fetchPromptDraft(draftIdFromUrl);
        const sourceTemplate = templatesResponse.find((template) => template.id === draft.template_id);

        setDraftId(draft.id);
        setMetadata({
          title: draft.title,
          customer_name: draft.customer_name,
          use_case: draft.use_case,
          template_id: draft.template_id,
          template_name: draft.template_name,
        });
        setSections(
          sourceTemplate
            ? hydrateDraftSectionsFromTemplates(draft.sections, sourceTemplate.sections)
            : hydrateDraftSectionsFromTemplates(draft.sections, []),
        );
        setPromptEditorText(draft.compiled_prompt || "");
        setIsPromptManuallyEdited(Boolean(draft.compiled_prompt));
        setIsBuilderInitialized(true);
        setSetupTemplateId(draft.template_id || "");
        setSetupPromptName(draft.title || "");
        return;
      }

      setDraftId("");
      setMetadata(EMPTY_METADATA);
      setSections([]);
      setPromptEditorText("");
      setIsPromptManuallyEdited(false);
      setIsBuilderInitialized(false);
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

  const handleSetupStart = () => {
    const selectedTemplate = readyTemplates.find((template) => template.id === setupTemplateId);
    if (!selectedTemplate) {
      toast.error("Please select a READY template.");
      return;
    }

    if (!setupPromptName.trim()) {
      toast.error("Please name your prompt to begin building.");
      return;
    }

    const templateSections = createBuilderSectionsFromTemplates(selectedTemplate.sections);
    setMetadata({
      ...EMPTY_METADATA,
      title: setupPromptName.trim(),
      template_id: selectedTemplate.id,
      template_name: selectedTemplate.name,
    });
    setSections(templateSections);
    setIsBuilderInitialized(true);
    setPromptEditorText("");
    setIsPromptManuallyEdited(false);
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
    const copied = await copyText(promptEditorText);
    if (copied) {
      toast.success("Prompt copied.");
      return;
    }
    toast.error("Unable to copy prompt.");
  };

  const handleDownloadPrompt = () => {
    const blob = new Blob([promptEditorText], { type: "text/plain" });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `${(metadata.title || "prompt-draft").replace(/\s+/g, "-").toLowerCase()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
    toast.success("Prompt downloaded.");
  };

  const handleSaveDraft = async () => {
    if (isReadOnly) {
      toast.error("Viewer role has read-only access.");
      return;
    }

    if (!isBuilderInitialized) {
      toast.error("Select a template and name your prompt first.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...metadata,
        sections,
        compiled_prompt: promptEditorText,
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

  if (!isBuilderInitialized) {
    return (
      <div className="pane-scroll h-[calc(100vh-84px)] overflow-y-auto p-6 md:p-8 lg:p-10" data-testid="builder-setup-page-container">
        <Card className="mx-auto max-w-2xl border-slate-200 shadow-sm" data-testid="builder-setup-card">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-slate-900" data-testid="builder-setup-title">
              Start Building a Prompt
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500" data-testid="builder-setup-template-label">
                Step 1: Select READY Template
              </label>
              <select
                value={setupTemplateId}
                onChange={(event) => setSetupTemplateId(event.target.value)}
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                data-testid="builder-setup-template-select"
              >
                <option value="">Select template</option>
                {readyTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500" data-testid="builder-setup-name-label">
                Step 2: Name Your Prompt
              </label>
              <Input
                value={setupPromptName}
                onChange={(event) => setSetupPromptName(event.target.value)}
                placeholder="e.g. Warehouse Safety Escalation Prompt"
                data-testid="builder-setup-name-input"
              />
            </div>

            <Button type="button" onClick={handleSetupStart} className="w-full" data-testid="builder-setup-start-button">
              Start Building
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-84px)] flex-col" data-testid="builder-page-container">
      <div
        className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-sm md:px-6"
        data-testid="builder-compact-header"
      >
        <div className="grid gap-3 lg:grid-cols-[1.8fr_auto_auto]" data-testid="builder-compact-header-grid">
          <Input
            value={metadata.title}
            disabled={isReadOnly}
            onChange={(event) => setMetadata((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="Prompt name"
            data-testid="builder-compact-title-input"
          />

          <Badge className="h-10 items-center bg-slate-100 px-4 text-slate-700" data-testid="builder-template-badge">
            Template: {metadata.template_name}
          </Badge>

          <Button type="button" onClick={handleSaveDraft} disabled={saving || isReadOnly} data-testid="builder-save-draft-button">
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1" data-testid="builder-resizable-container">
        <ResizablePanelGroup direction="horizontal" autoSaveId="builder-three-pane-layout" data-testid="builder-resizable-group">
          <ResizablePanel defaultSize={22} minSize={16} data-testid="builder-library-panel">
            <section className="pane-scroll h-full overflow-y-auto border-r border-slate-200 bg-slate-50/70 p-4" data-testid="builder-library-pane">
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

          <ResizablePanel defaultSize={33} minSize={22} data-testid="builder-config-panel">
            <section className="pane-scroll h-full overflow-y-auto border-r border-slate-200 bg-white p-4" data-testid="builder-config-pane">
              <div className="mb-4 flex items-center justify-between" data-testid="builder-configuration-header">
                <h2 className="text-xl font-bold text-slate-900" data-testid="builder-configuration-title">
                  Configure Sections
                </h2>
                <Badge className="bg-indigo-100 text-indigo-700" data-testid="builder-selected-sections-badge">
                  {selectedSections.length} selected
                </Badge>
              </div>

              <div className="space-y-5" data-testid="builder-configured-section-stack">
                {selectedSections.map((section, index) => (
                  <motion.div
                    key={section.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.02 }}
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
            </section>
          </ResizablePanel>

          <ResizableHandle withHandle data-testid="builder-config-preview-resize-handle" />

          <ResizablePanel defaultSize={45} minSize={30} data-testid="builder-preview-panel">
            <section className="pane-scroll flex h-full flex-col overflow-y-auto bg-slate-50/30 p-4" data-testid="builder-preview-pane">
              <div className="mb-3 flex items-center justify-between gap-2" data-testid="prompt-output-toolbar">
                <p className="text-sm font-semibold text-slate-800" data-testid="prompt-output-title">
                  Prompt Output (Editable)
                </p>
                <div className="flex items-center gap-1" data-testid="prompt-output-actions">
                  <Button type="button" variant="ghost" size="icon" onClick={handleCopyPrompt} data-testid="prompt-output-copy-button">
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleDownloadPrompt}
                    data-testid="prompt-output-download-button"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setPromptEditorText(compiledOutput.compiledPrompt);
                      setIsPromptManuallyEdited(false);
                    }}
                    data-testid="prompt-output-reset-button"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Textarea
                value={promptEditorText}
                onChange={(event) => {
                  setPromptEditorText(event.target.value);
                  setIsPromptManuallyEdited(true);
                }}
                className="h-full min-h-[520px] resize-none bg-white font-mono text-sm leading-relaxed"
                data-testid="prompt-output-textarea"
              />
            </section>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
};

export default BuilderPage;
