import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Plus, Save } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cloneTemplateLibraryItem, fetchTemplateLibrary, updateTemplateLibraryItem } from "@/lib/api";

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

const TemplatesPage = ({ role }) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [editableTemplate, setEditableTemplate] = useState(null);
  const [expandedSections, setExpandedSections] = useState({});
  const [expandedVariableGroups, setExpandedVariableGroups] = useState({});
  const [saving, setSaving] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [cloneForm, setCloneForm] = useState({ source_template_id: "", new_template_name: "" });

  const canManageTemplates = role === "admin";

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) || null,
    [selectedTemplateId, templates],
  );

  const initializeExpansionState = (template) => {
    const nextSectionState = {};
    const nextVariableState = {};

    (template?.sections || []).forEach((section) => {
      nextSectionState[section.id] = false;
      nextVariableState[`section-${section.id}`] = false;
      (section.subsections || []).forEach((subsection) => {
        nextVariableState[`subsection-${section.id}-${subsection.id}`] = false;
      });
    });

    setExpandedSections(nextSectionState);
    setExpandedVariableGroups(nextVariableState);
  };

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await fetchTemplateLibrary();
      setTemplates(response);

      if (!selectedTemplateId && response.length > 0) {
        setSelectedTemplateId(response[0].id);
        setEditableTemplate(JSON.parse(JSON.stringify(response[0])));
        initializeExpansionState(response[0]);
      }
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Unable to load templates.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    if (selectedTemplate) {
      setEditableTemplate(JSON.parse(JSON.stringify(selectedTemplate)));
      initializeExpansionState(selectedTemplate);
    }
  }, [selectedTemplate]);

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

  const toggleSection = (sectionId) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const toggleVariableGroup = (groupId) => {
    setExpandedVariableGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const handleCloneTemplate = async () => {
    if (!canManageTemplates) {
      toast.error("Only admin can create templates.");
      return;
    }

    if (!cloneForm.source_template_id || !cloneForm.new_template_name.trim()) {
      toast.error("Select source template and provide new template name.");
      return;
    }

    setCloning(true);
    try {
      const created = await cloneTemplateLibraryItem(cloneForm);
      toast.success("Template created from existing template.");
      setCloneForm({ source_template_id: "", new_template_name: "" });
      await loadTemplates();
      setSelectedTemplateId(created.id);
      setEditableTemplate(JSON.parse(JSON.stringify(created)));
      initializeExpansionState(created);
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Unable to clone template.");
    } finally {
      setCloning(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!canManageTemplates) {
      toast.error("Only admin can update templates.");
      return;
    }

    if (!editableTemplate) {
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: editableTemplate.name,
        status: editableTemplate.status,
        sections: editableTemplate.sections,
      };
      const updated = await updateTemplateLibraryItem(editableTemplate.id, payload);
      setTemplates((prev) => prev.map((template) => (template.id === updated.id ? updated : template)));
      setEditableTemplate(JSON.parse(JSON.stringify(updated)));
      toast.success("Template saved with current section sequence.");
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
      <div className="mb-8" data-testid="templates-page-header">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500" data-testid="templates-eyebrow">
          Template Library
        </p>
        <h2 className="mt-1 text-3xl font-bold text-slate-900" data-testid="templates-main-title">
          View Templates, Then Build New Ones from Existing
        </h2>
      </div>

      <Card className="mb-6 border-slate-200 shadow-sm" data-testid="template-overview-card">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-slate-900" data-testid="template-overview-title">
            All Templates
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="template-overview-grid">
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => setSelectedTemplateId(template.id)}
              className={[
                "rounded-lg border p-4 text-left transition-colors duration-200",
                selectedTemplateId === template.id ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-white hover:bg-slate-50",
              ].join(" ")}
              data-testid={`template-overview-item-${template.id}`}
            >
              <p className="text-sm font-semibold text-slate-900" data-testid={`template-overview-name-${template.id}`}>
                {template.name}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <Badge
                  className={template.status === "ready" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}
                  data-testid={`template-overview-status-${template.id}`}
                >
                  {template.status}
                </Badge>
                <Badge className="bg-sky-100 text-sky-700" data-testid={`template-overview-sections-${template.id}`}>
                  {template.sections.length} sections
                </Badge>
              </div>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card className="mb-6 border-slate-200 shadow-sm" data-testid="template-clone-card">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-slate-900" data-testid="template-clone-title">
            Build New Template from Existing Template
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <select
            value={cloneForm.source_template_id}
            onChange={(event) => setCloneForm((prev) => ({ ...prev, source_template_id: event.target.value }))}
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
            data-testid="template-clone-source-select"
          >
            <option value="">Select existing template</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>

          <Input
            value={cloneForm.new_template_name}
            onChange={(event) => setCloneForm((prev) => ({ ...prev, new_template_name: event.target.value }))}
            placeholder="Name for new template"
            data-testid="template-clone-name-input"
          />

          <Button type="button" onClick={handleCloneTemplate} disabled={cloning || !canManageTemplates} data-testid="template-clone-button">
            {cloning ? "Creating..." : "Create"}
          </Button>
        </CardContent>
      </Card>

      {editableTemplate && (
        <Card className="border-slate-200 shadow-sm" data-testid="template-editor-card">
          <CardContent className="space-y-6 p-6">
            <div className="grid gap-3 md:grid-cols-[1.3fr_220px_auto_auto]" data-testid="template-top-controls">
              <Input
                value={editableTemplate.name}
                onChange={(event) => setEditableTemplate((prev) => ({ ...prev, name: event.target.value }))}
                disabled={!canManageTemplates}
                placeholder="Template Name"
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
              <Button type="button" onClick={handleSaveTemplate} disabled={saving || !canManageTemplates} data-testid="template-save-button">
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : "Save Template"}
              </Button>
            </div>

            <div className="space-y-4" data-testid="template-sections-stack">
              {editableTemplate.sections.map((section, sectionIndex) => {
                const isExpanded = Boolean(expandedSections[section.id]);
                const sectionVariableGroupId = `section-${section.id}`;
                const sectionVariablesExpanded = Boolean(expandedVariableGroups[sectionVariableGroupId]);

                return (
                  <Card key={section.id} className="border-sky-200 bg-sky-50/40" data-testid={`template-section-card-${section.id}`}>
                    <CardHeader className="pb-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleSection(section.id)}
                            data-testid={`template-section-expand-toggle-${section.id}`}
                          >
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </Button>
                          <p className="text-sm font-semibold text-sky-900" data-testid={`template-section-sequence-${section.id}`}>
                            Section {sectionIndex + 1}
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
                              onClick={() => toggleVariableGroup(sectionVariableGroupId)}
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
                                  placeholder="variable_key"
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
                                  placeholder="Label"
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
                                  value={(variable.options || []).join(", ")}
                                  onChange={(event) =>
                                    updateSection(section.id, (prev) => {
                                      const nextVariables = [...prev.variables];
                                      nextVariables[variableIndex] = {
                                        ...nextVariables[variableIndex],
                                        options: event.target.value
                                          .split(",")
                                          .map((item) => item.trim())
                                          .filter(Boolean),
                                      };
                                      return { ...prev, variables: nextVariables };
                                    })
                                  }
                                  disabled={!canManageTemplates}
                                  placeholder="Option A, Option B"
                                  data-testid={`template-variable-options-${section.id}-${variableIndex}`}
                                />
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
                              </div>
                            ))}
                        </div>

                        <div className="space-y-3 rounded-md border border-emerald-200 bg-emerald-50 p-3" data-testid={`template-subsections-group-${section.id}`}>
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-emerald-800" data-testid={`template-subsections-title-${section.id}`}>
                              Subsections ({(section.subsections || []).length})
                            </p>
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
                                setExpandedVariableGroups((prev) => ({
                                  ...prev,
                                  [`subsection-${section.id}-${newSubsection.id}`]: false,
                                }));
                              }}
                              disabled={!canManageTemplates}
                              data-testid={`template-section-add-subsection-${section.id}`}
                            >
                              Add Subsection
                            </Button>
                          </div>

                          {(section.subsections || []).map((subsection) => {
                            const subsectionVariableGroupId = `subsection-${section.id}-${subsection.id}`;
                            const subsectionVariablesExpanded = Boolean(expandedVariableGroups[subsectionVariableGroupId]);

                            return (
                              <div
                                key={subsection.id}
                                className="rounded-md border border-emerald-200 bg-white p-3"
                                data-testid={`template-subsection-card-${section.id}-${subsection.id}`}
                              >
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
                                  className="mt-2 min-h-20 font-mono text-sm"
                                  data-testid={`template-subsection-textarea-${section.id}-${subsection.id}`}
                                />

                                <div className="mt-2 rounded-md border border-violet-200 bg-violet-50 p-2">
                                  <div className="mb-2 flex items-center justify-between">
                                    <button
                                      type="button"
                                      onClick={() => toggleVariableGroup(subsectionVariableGroupId)}
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
                                              nextVariables[variableIndex] = { ...nextVariables[variableIndex], key: event.target.value };
                                              return { ...prev, variables: nextVariables };
                                            })
                                          }
                                          disabled={!canManageTemplates}
                                          placeholder="variable_key"
                                          data-testid={`template-subsection-variable-key-${section.id}-${subsection.id}-${variableIndex}`}
                                        />
                                        <Input
                                          value={variable.label}
                                          onChange={(event) =>
                                            updateSubsection(section.id, subsection.id, (prev) => {
                                              const nextVariables = [...prev.variables];
                                              nextVariables[variableIndex] = { ...nextVariables[variableIndex], label: event.target.value };
                                              return { ...prev, variables: nextVariables };
                                            })
                                          }
                                          disabled={!canManageTemplates}
                                          placeholder="Label"
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
                                          value={(variable.options || []).join(", ")}
                                          onChange={(event) =>
                                            updateSubsection(section.id, subsection.id, (prev) => {
                                              const nextVariables = [...prev.variables];
                                              nextVariables[variableIndex] = {
                                                ...nextVariables[variableIndex],
                                                options: event.target.value
                                                  .split(",")
                                                  .map((item) => item.trim())
                                                  .filter(Boolean),
                                              };
                                              return { ...prev, variables: nextVariables };
                                            })
                                          }
                                          disabled={!canManageTemplates}
                                          placeholder="Option A, Option B"
                                          data-testid={`template-subsection-variable-options-${section.id}-${subsection.id}-${variableIndex}`}
                                        />
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
                                      </div>
                                    ))}
                                </div>
                              </div>
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
