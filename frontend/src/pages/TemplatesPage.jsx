import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Plus,
  Save,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  archiveTemplateLibraryItem,
  cloneTemplateLibraryItem,
  fetchArchivedTemplates,
  fetchTemplateLibrary,
  updateTemplateLibraryItem,
} from "@/lib/api";

const VARIABLE_TYPES = [
  { value: "text", label: "Text variable" },
  { value: "select", label: "Pre-defined dropdown" },
  { value: "multiselect", label: "Multi select dropdown" },
];

const createNewVariable = () => ({
  key: "",
  label: "",
  placeholder: "",
  required: false,
  default_value: "",
  input_type: "text",
  options: [],
  options_text: "",
});

const createNewSubsection = () => ({
  id: `sub_${crypto.randomUUID()}`,
  title: "New Subsection",
  description: "",
  template_text: "",
  variables: [],
  enabled_by_default: true,
});

const createNewSection = () => ({
  id: `section_${crypto.randomUUID()}`,
  name: "New Section",
  description: "",
  template_text: "",
  variables: [],
  subsections: [],
  enabled_by_default: true,
});

const removePlaceholderToken = (text = "", variableKey = "") => {
  if (!variableKey?.trim()) {
    return text;
  }

  const escaped = variableKey.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\{\\s*${escaped}\\s*\\}`, "g");
  return text.replace(pattern, "").replace(/\s{2,}/g, " ").trim();
};

const normalizeTemplateForEditing = (template) => {
  const normalized = JSON.parse(JSON.stringify(template));

  normalized.sections = (normalized.sections || []).map((section) => ({
    ...section,
    variables: (section.variables || []).map((variable) => ({
      ...variable,
      options_text: (variable.options || []).join(", "),
    })),
    subsections: (section.subsections || []).map((subsection) => ({
      ...subsection,
      variables: (subsection.variables || []).map((variable) => ({
        ...variable,
        options_text: (variable.options || []).join(", "),
      })),
    })),
  }));

  return normalized;
};

const parseOptionsText = (value = "") =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const prepareTemplateForSave = (template) => {
  return {
    ...template,
    sections: (template.sections || []).map((section) => ({
      ...section,
      variables: (section.variables || []).map((variable) => {
        const { options_text, ...rest } = variable;
        return {
          ...rest,
          options: parseOptionsText(options_text || ""),
        };
      }),
      subsections: (section.subsections || []).map((subsection) => ({
        ...subsection,
        variables: (subsection.variables || []).map((variable) => {
          const { options_text, ...rest } = variable;
          return {
            ...rest,
            options: parseOptionsText(options_text || ""),
          };
        }),
      })),
    })),
  };
};

const TemplatesPage = ({ role }) => {
  const [templates, setTemplates] = useState([]);
  const [archivedTemplates, setArchivedTemplates] = useState([]);
  const [showArchivedTemplates, setShowArchivedTemplates] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editableTemplate, setEditableTemplate] = useState(null);
  const [expandedSections, setExpandedSections] = useState({});
  const [expandedSubsections, setExpandedSubsections] = useState({});
  const [expandedVariableGroups, setExpandedVariableGroups] = useState({});
  const [draggedSectionId, setDraggedSectionId] = useState("");
  const [saving, setSaving] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [archiveInProgressId, setArchiveInProgressId] = useState("");
  const [createModal, setCreateModal] = useState({ open: false, sourceTemplateId: "", newTemplateName: "" });
  const [archiveModal, setArchiveModal] = useState({ open: false, step: 1, templateId: "", templateName: "" });

  const canManageTemplates = role === "admin";
  const visibleTemplateList = showArchivedTemplates ? archivedTemplates : templates;

  const selectedTemplateForModal = useMemo(
    () => templates.find((template) => template.id === createModal.sourceTemplateId),
    [createModal.sourceTemplateId, templates],
  );

  const initializeExpansionState = (template) => {
    const sectionState = {};
    const subsectionState = {};
    const variableGroupState = {};

    (template?.sections || []).forEach((section) => {
      sectionState[section.id] = false;
      variableGroupState[`section-${section.id}`] = false;

      (section.subsections || []).forEach((subsection) => {
        subsectionState[`${section.id}-${subsection.id}`] = false;
        variableGroupState[`subsection-${section.id}-${subsection.id}`] = false;
      });
    });

    setExpandedSections(sectionState);
    setExpandedSubsections(subsectionState);
    setExpandedVariableGroups(variableGroupState);
  };

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const [active, archived] = await Promise.all([fetchTemplateLibrary(), fetchArchivedTemplates()]);
      setTemplates(active);
      setArchivedTemplates(archived);
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Unable to load templates.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const openEditor = (template) => {
    setEditableTemplate(normalizeTemplateForEditing(template));
    initializeExpansionState(template);
    setIsEditorOpen(true);
  };

  const updateSection = (sectionId, updater) => {
    setEditableTemplate((prev) => ({
      ...prev,
      sections: prev.sections.map((section) => (section.id === sectionId ? updater(section) : section)),
    }));
  };

  const updateSubsection = (sectionId, subsectionId, updater) => {
    updateSection(sectionId, (section) => ({
      ...section,
      subsections: section.subsections.map((subsection) =>
        subsection.id === subsectionId ? updater(subsection) : subsection,
      ),
    }));
  };

  const moveSection = (sectionId, direction) => {
    setEditableTemplate((prev) => {
      const currentIndex = prev.sections.findIndex((section) => section.id === sectionId);
      if (currentIndex === -1) {
        return prev;
      }

      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= prev.sections.length) {
        return prev;
      }

      const nextSections = [...prev.sections];
      [nextSections[currentIndex], nextSections[targetIndex]] = [nextSections[targetIndex], nextSections[currentIndex]];
      return { ...prev, sections: nextSections };
    });
  };

  const reorderByDragAndDrop = (sourceSectionId, targetSectionId) => {
    setEditableTemplate((prev) => {
      const sourceIndex = prev.sections.findIndex((section) => section.id === sourceSectionId);
      const targetIndex = prev.sections.findIndex((section) => section.id === targetSectionId);

      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
        return prev;
      }

      const nextSections = [...prev.sections];
      const [sourceSection] = nextSections.splice(sourceIndex, 1);
      nextSections.splice(targetIndex, 0, sourceSection);
      return { ...prev, sections: nextSections };
    });
  };

  const toggleSection = (sectionId) => {
    setExpandedSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const toggleSubsection = (sectionId, subsectionId) => {
    const key = `${sectionId}-${subsectionId}`;
    setExpandedSubsections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleVariableGroup = (groupId) => {
    setExpandedVariableGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const handleOpenCreateModal = (templateId) => {
    setCreateModal({
      open: true,
      sourceTemplateId: templateId,
      newTemplateName: "",
    });
  };

  const handleCreateFromExisting = async () => {
    if (!canManageTemplates) {
      toast.error("Only admin can create templates.");
      return;
    }

    if (!createModal.sourceTemplateId || !createModal.newTemplateName.trim()) {
      toast.error("Select a base template and provide new template name.");
      return;
    }

    setCloning(true);
    try {
      const created = await cloneTemplateLibraryItem({
        source_template_id: createModal.sourceTemplateId,
        new_template_name: createModal.newTemplateName.trim(),
      });
      toast.success("Template created successfully.");
      setCreateModal({ open: false, sourceTemplateId: "", newTemplateName: "" });
      await loadTemplates();
      openEditor(created);
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Unable to create template.");
    } finally {
      setCloning(false);
    }
  };

  const handleQuickReadyToggle = async (template, checked) => {
    if (!canManageTemplates) {
      toast.error("Only admin can update template readiness.");
      return;
    }

    try {
      await updateTemplateLibraryItem(template.id, {
        name: template.name,
        status: checked ? "ready" : "draft",
        sections: template.sections,
      });
      await loadTemplates();
      toast.success("Template status updated.");
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Unable to update template status.");
    }
  };

  const handleArchiveTemplate = async (templateId) => {
    if (!canManageTemplates) {
      toast.error("Only admin can archive templates.");
      return;
    }

    const template = templates.find((item) => item.id === templateId);
    setArchiveModal({
      open: true,
      step: 1,
      templateId,
      templateName: template?.name || "this template",
    });
  };

  const confirmArchiveTemplate = async () => {
    if (!archiveModal.templateId) {
      return;
    }

    setArchiveInProgressId(archiveModal.templateId);
    try {
      await archiveTemplateLibraryItem(archiveModal.templateId);
      await loadTemplates();
      toast.success("Template archived.");
      setArchiveModal({ open: false, step: 1, templateId: "", templateName: "" });
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Unable to archive template.");
    } finally {
      setArchiveInProgressId("");
    }
  };

  const handleSaveTemplate = async () => {
    if (!canManageTemplates || !editableTemplate) {
      return;
    }

    setSaving(true);
    try {
      const prepared = prepareTemplateForSave(editableTemplate);
      const updated = await updateTemplateLibraryItem(editableTemplate.id, {
        name: prepared.name,
        status: prepared.status,
        sections: prepared.sections,
      });
      setEditableTemplate(normalizeTemplateForEditing(updated));
      await loadTemplates();
      toast.success("Template saved with current sequence.");
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Unable to save template.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-84px)] items-center justify-center" data-testid="templates-loading-state">
        <p className="text-base font-semibold text-slate-700">Loading template library...</p>
      </div>
    );
  }

  return (
    <div className="pane-scroll h-[calc(100vh-84px)] overflow-y-auto bg-gradient-to-br from-slate-50 via-white to-amber-50/30 p-6 md:p-8 lg:p-10" data-testid="templates-page-container">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500" data-testid="templates-eyebrow">
            Template Library
          </p>
          <h2 className="mt-1 text-3xl font-bold text-slate-900" data-testid="templates-main-title">
            Step 1: Pick a Base Template · Step 2: Name and Build New Template
          </h2>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => setShowArchivedTemplates((prev) => !prev)}
          data-testid="templates-archived-toggle-button"
        >
          {showArchivedTemplates ? "Back to Active Templates" : "View Archived Templates"}
        </Button>
      </div>

      {!isEditorOpen && (
        <Card className="border-slate-200 shadow-sm" data-testid="template-overview-card">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-900" data-testid="template-overview-title">
              {showArchivedTemplates ? "Archived Templates" : "Available Templates"}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="template-overview-grid">
            {visibleTemplateList.map((template) => (
              <Card key={template.id} className="border-slate-200" data-testid={`template-overview-item-${template.id}`}>
                <CardContent className="space-y-3 p-4">
                  <p className="text-sm font-semibold text-slate-900" data-testid={`template-overview-name-${template.id}`}>
                    {template.name}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      className={template.status === "ready" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}
                      data-testid={`template-overview-status-${template.id}`}
                    >
                      {template.status}
                    </Badge>
                    {template.archived && (
                      <Badge className="bg-slate-200 text-slate-700" data-testid={`template-overview-archived-${template.id}`}>
                        archived
                      </Badge>
                    )}
                  </div>

                  {!template.archived && (
                    <label className="flex items-center gap-2 text-sm text-slate-700" data-testid={`template-ready-checkbox-group-${template.id}`}>
                      <input
                        type="checkbox"
                        checked={template.status === "ready"}
                        onChange={(event) => handleQuickReadyToggle(template, event.target.checked)}
                        disabled={!canManageTemplates}
                        data-testid={`template-ready-checkbox-${template.id}`}
                      />
                      Mark as Ready
                    </label>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {!template.archived && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenCreateModal(template.id)}
                        data-testid={`template-build-on-top-button-${template.id}`}
                      >
                        Build on Top
                      </Button>
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openEditor(template)}
                      data-testid={`template-edit-button-${template.id}`}
                    >
                      Edit
                    </Button>

                    {!template.archived && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => handleArchiveTemplate(template.id)}
                        disabled={!canManageTemplates || archiveInProgressId === template.id}
                        data-testid={`template-archive-button-${template.id}`}
                      >
                        {archiveInProgressId === template.id ? "Archiving..." : "Archive"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}

      {createModal.open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4" data-testid="template-create-modal-overlay">
          <Card className="w-full max-w-xl border-slate-200" data-testid="template-create-modal-card">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-slate-900" data-testid="template-create-modal-title">
                Create New Template from Existing Template
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-700" data-testid="template-create-modal-source-name">
                Base Template: <strong>{selectedTemplateForModal?.name || "Not selected"}</strong>
              </p>
              <Input
                value={createModal.newTemplateName}
                onChange={(event) => setCreateModal((prev) => ({ ...prev, newTemplateName: event.target.value }))}
                placeholder="Enter new template name"
                data-testid="template-create-modal-name-input"
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateModal({ open: false, sourceTemplateId: "", newTemplateName: "" })}
                  data-testid="template-create-modal-cancel-button"
                >
                  Cancel
                </Button>
                <Button type="button" onClick={handleCreateFromExisting} disabled={cloning} data-testid="template-create-modal-confirm-button">
                  {cloning ? "Creating..." : "Create and Open Editor"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {archiveModal.open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4" data-testid="template-archive-modal-overlay">
          <Card className="w-full max-w-xl border-slate-200" data-testid="template-archive-modal-card">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-slate-900" data-testid="template-archive-modal-title">
                Archive Template Confirmation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {archiveModal.step === 1 && (
                <p className="text-sm text-slate-700" data-testid="template-archive-step-1-text">
                  Step 1: Do you want to archive <strong>{archiveModal.templateName}</strong>?
                </p>
              )}

              {archiveModal.step === 2 && (
                <p className="text-sm text-slate-700" data-testid="template-archive-step-2-text">
                  Step 2: This will move the template to <strong>Archived</strong> and set it to <strong>Not Ready</strong>. Confirm to continue.
                </p>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setArchiveModal({ open: false, step: 1, templateId: "", templateName: "" })}
                  data-testid="template-archive-cancel-button"
                >
                  Cancel
                </Button>

                {archiveModal.step === 1 && (
                  <Button
                    type="button"
                    onClick={() => setArchiveModal((prev) => ({ ...prev, step: 2 }))}
                    data-testid="template-archive-step1-confirm-button"
                  >
                    Continue
                  </Button>
                )}

                {archiveModal.step === 2 && (
                  <Button
                    type="button"
                    onClick={confirmArchiveTemplate}
                    disabled={archiveInProgressId === archiveModal.templateId}
                    data-testid="template-archive-step2-confirm-button"
                  >
                    {archiveInProgressId === archiveModal.templateId ? "Archiving..." : "Archive Template"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {isEditorOpen && editableTemplate && (
        <Card className="mt-6 border-slate-200 shadow-sm" data-testid="template-editor-card">
          <CardHeader className="border-b border-slate-100 bg-slate-50/70">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-xl font-bold text-slate-900" data-testid="template-editor-title">
                Editing: {editableTemplate.name}
              </CardTitle>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setIsEditorOpen(false)} data-testid="template-editor-back-button">
                  Back to Template List
                </Button>
                <Button type="button" onClick={handleSaveTemplate} disabled={saving || !canManageTemplates} data-testid="template-save-button">
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "Saving..." : "Save Template"}
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 p-6">
            <div className="grid gap-3 md:grid-cols-[1.5fr_240px_auto]">
              <Input
                value={editableTemplate.name}
                onChange={(event) => setEditableTemplate((prev) => ({ ...prev, name: event.target.value }))}
                disabled={!canManageTemplates}
                data-testid="template-name-input"
              />
              <select
                value={editableTemplate.status}
                onChange={(event) => setEditableTemplate((prev) => ({ ...prev, status: event.target.value }))}
                disabled={!canManageTemplates}
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                data-testid="template-status-select"
              >
                <option value="draft">Draft</option>
                <option value="ready">Ready</option>
              </select>
              <Button
                type="button"
                onClick={() => {
                  const newSection = createNewSection();
                  setEditableTemplate((prev) => ({ ...prev, sections: [...prev.sections, newSection] }));
                  setExpandedSections((prev) => ({ ...prev, [newSection.id]: true }));
                  setExpandedVariableGroups((prev) => ({ ...prev, [`section-${newSection.id}`]: false }));
                }}
                disabled={!canManageTemplates}
                data-testid="template-add-section-button"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Section
              </Button>
            </div>

            <div className="space-y-4" data-testid="template-sections-stack">
              {editableTemplate.sections.map((section, sectionIndex) => {
                const isExpanded = Boolean(expandedSections[section.id]);
                const sectionVariablesExpanded = Boolean(expandedVariableGroups[`section-${section.id}`]);

                return (
                  <Card
                    key={section.id}
                    className="border-sky-200 bg-sky-50/40"
                    draggable
                    onDragStart={() => setDraggedSectionId(section.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      reorderByDragAndDrop(draggedSectionId, section.id);
                      setDraggedSectionId("");
                    }}
                    data-testid={`template-section-card-${section.id}`}
                  >
                    <CardHeader className="py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-sky-700" data-testid={`template-section-drag-handle-${section.id}`} />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleSection(section.id)}
                            data-testid={`template-section-expand-toggle-${section.id}`}
                          >
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </Button>
                          <p className="text-sm font-semibold text-sky-900" data-testid={`template-section-header-name-${section.id}`}>
                            {section.name || `Section ${sectionIndex + 1}`}
                          </p>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => moveSection(section.id, "up")}
                            disabled={sectionIndex === 0 || !canManageTemplates}
                            data-testid={`template-section-move-up-${section.id}`}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => moveSection(section.id, "down")}
                            disabled={sectionIndex === editableTemplate.sections.length - 1 || !canManageTemplates}
                            data-testid={`template-section-move-down-${section.id}`}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    {isExpanded && (
                      <CardContent className="space-y-4 pt-0">
                        <Input
                          value={section.name}
                          onChange={(event) => updateSection(section.id, (prev) => ({ ...prev, name: event.target.value }))}
                          disabled={!canManageTemplates}
                          data-testid={`template-section-name-input-${section.id}`}
                        />
                        <Textarea
                          value={section.template_text}
                          onChange={(event) => updateSection(section.id, (prev) => ({ ...prev, template_text: event.target.value }))}
                          disabled={!canManageTemplates}
                          className="min-h-24 font-mono text-sm"
                          data-testid={`template-section-textarea-${section.id}`}
                        />

                        <div className="rounded-md border border-amber-200 bg-amber-50 p-3" data-testid={`template-section-variables-group-${section.id}`}>
                          <div className="mb-2 flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => toggleVariableGroup(`section-${section.id}`)}
                              className="text-sm font-semibold text-amber-800"
                              data-testid={`template-section-variables-toggle-${section.id}`}
                            >
                              {sectionVariablesExpanded ? "▼" : "▶"} Variables ({(section.variables || []).length})
                            </button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                updateSection(section.id, (prev) => ({
                                  ...prev,
                                  variables: [...(prev.variables || []), createNewVariable()],
                                }))
                              }
                              disabled={!canManageTemplates}
                              data-testid={`template-section-add-variable-${section.id}`}
                            >
                              Add Variable
                            </Button>
                          </div>

                          {sectionVariablesExpanded &&
                            (section.variables || []).map((variable, variableIndex) => (
                              <div
                                key={`${section.id}-var-${variableIndex}`}
                                className="mb-2 grid gap-2 rounded-md border border-amber-200 bg-white p-3 md:grid-cols-[1fr_1fr_200px_1fr_auto]"
                                data-testid={`template-variable-row-${section.id}-${variableIndex}`}
                              >
                                <Input
                                  value={variable.key}
                                  onChange={(event) =>
                                    updateSection(section.id, (prev) => {
                                      const nextVariables = [...prev.variables];
                                      nextVariables[variableIndex] = { ...nextVariables[variableIndex], key: event.target.value };
                                      return { ...prev, variables: nextVariables };
                                    })
                                  }
                                  disabled={!canManageTemplates}
                                  data-testid={`template-variable-key-${section.id}-${variableIndex}`}
                                />
                                <Input
                                  value={variable.label}
                                  onChange={(event) =>
                                    updateSection(section.id, (prev) => {
                                      const nextVariables = [...prev.variables];
                                      nextVariables[variableIndex] = { ...nextVariables[variableIndex], label: event.target.value };
                                      return { ...prev, variables: nextVariables };
                                    })
                                  }
                                  disabled={!canManageTemplates}
                                  data-testid={`template-variable-label-${section.id}-${variableIndex}`}
                                />
                                <select
                                  value={variable.input_type || "text"}
                                  onChange={(event) =>
                                    updateSection(section.id, (prev) => {
                                      const nextVariables = [...prev.variables];
                                      nextVariables[variableIndex] = {
                                        ...nextVariables[variableIndex],
                                        input_type: event.target.value,
                                      };
                                      return { ...prev, variables: nextVariables };
                                    })
                                  }
                                  disabled={!canManageTemplates}
                                  className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                                  data-testid={`template-variable-type-${section.id}-${variableIndex}`}
                                >
                                  {VARIABLE_TYPES.map((option) => (
                                    <option key={`${section.id}-${variableIndex}-${option.value}`} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                                <Input
                                  value={variable.options_text ?? (variable.options || []).join(", ")}
                                  onChange={(event) =>
                                    updateSection(section.id, (prev) => {
                                      const nextVariables = [...prev.variables];
                                      nextVariables[variableIndex] = {
                                        ...nextVariables[variableIndex],
                                        options_text: event.target.value,
                                      };
                                      return { ...prev, variables: nextVariables };
                                    })
                                  }
                                  disabled={!canManageTemplates}
                                  data-testid={`template-variable-options-${section.id}-${variableIndex}`}
                                />
                                <div className="flex gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() =>
                                      updateSection(section.id, (prev) => ({
                                        ...prev,
                                        template_text: `${prev.template_text} {${variable.key}}`.trim(),
                                      }))
                                    }
                                    disabled={!canManageTemplates || !variable.key}
                                    data-testid={`template-variable-insert-${section.id}-${variableIndex}`}
                                  >
                                    Insert
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    onClick={() =>
                                      updateSection(section.id, (prev) => {
                                        const variableToRemove = prev.variables[variableIndex];
                                        const nextVariables = prev.variables.filter((_, index) => index !== variableIndex);

                                        return {
                                          ...prev,
                                          variables: nextVariables,
                                          template_text: removePlaceholderToken(prev.template_text, variableToRemove?.key || ""),
                                        };
                                      })
                                    }
                                    disabled={!canManageTemplates}
                                    data-testid={`template-variable-delete-${section.id}-${variableIndex}`}
                                  >
                                    Delete
                                  </Button>
                                </div>
                              </div>
                            ))}
                        </div>

                        <div className="space-y-3 rounded-md border border-emerald-200 bg-emerald-50 p-3" data-testid={`template-subsections-group-${section.id}`}>
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-emerald-800">Subsections ({(section.subsections || []).length})</p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const newSubsection = createNewSubsection();
                                updateSection(section.id, (prev) => ({
                                  ...prev,
                                  subsections: [...(prev.subsections || []), newSubsection],
                                }));
                                setExpandedSubsections((prev) => ({
                                  ...prev,
                                  [`${section.id}-${newSubsection.id}`]: true,
                                }));
                              }}
                              disabled={!canManageTemplates}
                              data-testid={`template-section-add-subsection-${section.id}`}
                            >
                              Add Subsection
                            </Button>
                          </div>

                          {(section.subsections || []).map((subsection) => {
                            const subsectionKey = `${section.id}-${subsection.id}`;
                            const subsectionExpanded = Boolean(expandedSubsections[subsectionKey]);
                            const subsectionVariablesExpanded = Boolean(
                              expandedVariableGroups[`subsection-${section.id}-${subsection.id}`],
                            );

                            return (
                              <Card key={subsection.id} className="border-emerald-200 bg-white" data-testid={`template-subsection-card-${section.id}-${subsection.id}`}>
                                <CardHeader className="py-3">
                                  <button
                                    type="button"
                                    onClick={() => toggleSubsection(section.id, subsection.id)}
                                    className="flex items-center gap-2 text-left text-sm font-semibold text-emerald-900"
                                    data-testid={`template-subsection-expand-toggle-${section.id}-${subsection.id}`}
                                  >
                                    {subsectionExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                    {subsection.title || "Untitled Subsection"}
                                  </button>
                                </CardHeader>

                                {subsectionExpanded && (
                                  <CardContent className="space-y-3 pt-0">
                                    <Input
                                      value={subsection.title}
                                      onChange={(event) =>
                                        updateSubsection(section.id, subsection.id, (prev) => ({ ...prev, title: event.target.value }))
                                      }
                                      disabled={!canManageTemplates}
                                      data-testid={`template-subsection-title-${section.id}-${subsection.id}`}
                                    />
                                    <Textarea
                                      value={subsection.template_text}
                                      onChange={(event) =>
                                        updateSubsection(section.id, subsection.id, (prev) => ({
                                          ...prev,
                                          template_text: event.target.value,
                                        }))
                                      }
                                      disabled={!canManageTemplates}
                                      className="min-h-20 font-mono text-sm"
                                      data-testid={`template-subsection-textarea-${section.id}-${subsection.id}`}
                                    />

                                    <div className="rounded-md border border-violet-200 bg-violet-50 p-2">
                                      <div className="mb-2 flex items-center justify-between">
                                        <button
                                          type="button"
                                          onClick={() => toggleVariableGroup(`subsection-${section.id}-${subsection.id}`)}
                                          className="text-sm font-semibold text-violet-800"
                                          data-testid={`template-subsection-variables-toggle-${section.id}-${subsection.id}`}
                                        >
                                          {subsectionVariablesExpanded ? "▼" : "▶"} Variables ({(subsection.variables || []).length})
                                        </button>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={() =>
                                            updateSubsection(section.id, subsection.id, (prev) => ({
                                              ...prev,
                                              variables: [...(prev.variables || []), createNewVariable()],
                                            }))
                                          }
                                          disabled={!canManageTemplates}
                                          data-testid={`template-subsection-add-variable-${section.id}-${subsection.id}`}
                                        >
                                          Add Variable
                                        </Button>
                                      </div>

                                      {subsectionVariablesExpanded &&
                                        (subsection.variables || []).map((variable, variableIndex) => (
                                          <div
                                            key={`${subsection.id}-var-${variableIndex}`}
                                            className="mb-2 grid gap-2 rounded-md border border-violet-200 bg-white p-2 md:grid-cols-[1fr_1fr_180px_1fr_auto]"
                                            data-testid={`template-subsection-variable-row-${section.id}-${subsection.id}-${variableIndex}`}
                                          >
                                            <Input
                                              value={variable.key}
                                              onChange={(event) =>
                                                updateSubsection(section.id, subsection.id, (prev) => {
                                                  const nextVariables = [...prev.variables];
                                                  nextVariables[variableIndex] = {
                                                    ...nextVariables[variableIndex],
                                                    key: event.target.value,
                                                  };
                                                  return { ...prev, variables: nextVariables };
                                                })
                                              }
                                              disabled={!canManageTemplates}
                                              data-testid={`template-subsection-variable-key-${section.id}-${subsection.id}-${variableIndex}`}
                                            />
                                            <Input
                                              value={variable.label}
                                              onChange={(event) =>
                                                updateSubsection(section.id, subsection.id, (prev) => {
                                                  const nextVariables = [...prev.variables];
                                                  nextVariables[variableIndex] = {
                                                    ...nextVariables[variableIndex],
                                                    label: event.target.value,
                                                  };
                                                  return { ...prev, variables: nextVariables };
                                                })
                                              }
                                              disabled={!canManageTemplates}
                                              data-testid={`template-subsection-variable-label-${section.id}-${subsection.id}-${variableIndex}`}
                                            />
                                            <select
                                              value={variable.input_type || "text"}
                                              onChange={(event) =>
                                                updateSubsection(section.id, subsection.id, (prev) => {
                                                  const nextVariables = [...prev.variables];
                                                  nextVariables[variableIndex] = {
                                                    ...nextVariables[variableIndex],
                                                    input_type: event.target.value,
                                                  };
                                                  return { ...prev, variables: nextVariables };
                                                })
                                              }
                                              disabled={!canManageTemplates}
                                              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                                              data-testid={`template-subsection-variable-type-${section.id}-${subsection.id}-${variableIndex}`}
                                            >
                                              {VARIABLE_TYPES.map((option) => (
                                                <option key={`${subsection.id}-${variableIndex}-${option.value}`} value={option.value}>
                                                  {option.label}
                                                </option>
                                              ))}
                                            </select>
                                            <Input
                                              value={variable.options_text ?? (variable.options || []).join(", ")}
                                              onChange={(event) =>
                                                updateSubsection(section.id, subsection.id, (prev) => {
                                                  const nextVariables = [...prev.variables];
                                                  nextVariables[variableIndex] = {
                                                    ...nextVariables[variableIndex],
                                                    options_text: event.target.value,
                                                  };
                                                  return { ...prev, variables: nextVariables };
                                                })
                                              }
                                              disabled={!canManageTemplates}
                                              data-testid={`template-subsection-variable-options-${section.id}-${subsection.id}-${variableIndex}`}
                                            />
                                            <div className="flex gap-1">
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                onClick={() =>
                                                  updateSubsection(section.id, subsection.id, (prev) => ({
                                                    ...prev,
                                                    template_text: `${prev.template_text} {${variable.key}}`.trim(),
                                                  }))
                                                }
                                                disabled={!canManageTemplates || !variable.key}
                                                data-testid={`template-subsection-variable-insert-${section.id}-${subsection.id}-${variableIndex}`}
                                              >
                                                Insert
                                              </Button>
                                              <Button
                                                type="button"
                                                variant="destructive"
                                                onClick={() =>
                                                  updateSubsection(section.id, subsection.id, (prev) => {
                                                    const variableToRemove = prev.variables[variableIndex];
                                                    const nextVariables = prev.variables.filter((_, index) => index !== variableIndex);
                                                    return {
                                                      ...prev,
                                                      variables: nextVariables,
                                                      template_text: removePlaceholderToken(prev.template_text, variableToRemove?.key || ""),
                                                    };
                                                  })
                                                }
                                                disabled={!canManageTemplates}
                                                data-testid={`template-subsection-variable-delete-${section.id}-${subsection.id}-${variableIndex}`}
                                              >
                                                Delete
                                              </Button>
                                            </div>
                                          </div>
                                        ))}
                                    </div>
                                  </CardContent>
                                )}
                              </Card>
                            );
                          })}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TemplatesPage;
