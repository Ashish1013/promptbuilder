import { useEffect, useMemo, useState } from "react";
import { Plus, Save } from "lucide-react";
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
  const [saving, setSaving] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [cloneForm, setCloneForm] = useState({ source_template_id: "", new_template_name: "" });

  const canManageTemplates = role === "admin";

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) || null,
    [selectedTemplateId, templates],
  );

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await fetchTemplateLibrary();
      setTemplates(response);

      if (!selectedTemplateId && response.length > 0) {
        setSelectedTemplateId(response[0].id);
        setEditableTemplate(JSON.parse(JSON.stringify(response[0])));
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
      toast.success("Template saved.");
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
    <div className="pane-scroll h-[calc(100vh-84px)] overflow-y-auto p-6 md:p-8 lg:p-10" data-testid="templates-page-container">
      <div className="mb-8" data-testid="templates-page-header">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500" data-testid="templates-eyebrow">
          Template Library
        </p>
        <h2 className="mt-1 text-3xl font-bold text-slate-900" data-testid="templates-main-title">
          Build Templates from Existing Ones
        </h2>
      </div>

      <Card className="mb-6 border-slate-200 shadow-sm" data-testid="template-clone-card">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-slate-900" data-testid="template-clone-title">
            Create New Template Using Existing Template
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

      <div className="mb-4 flex flex-wrap items-center gap-3" data-testid="template-selection-bar">
        <select
          value={selectedTemplateId}
          onChange={(event) => setSelectedTemplateId(event.target.value)}
          className="h-10 min-w-[320px] rounded-md border border-slate-300 bg-white px-3 text-sm"
          data-testid="template-selected-template-select"
        >
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>

        {editableTemplate && (
          <>
            <Badge className="bg-slate-100 text-slate-700" data-testid="template-selected-status-badge">
              Status: {editableTemplate.status}
            </Badge>
            <Button
              type="button"
              onClick={() =>
                setEditableTemplate((prev) => ({
                  ...prev,
                  sections: [...prev.sections, createNewSection()],
                }))
              }
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
          </>
        )}
      </div>

      {editableTemplate && (
        <Card className="border-slate-200 shadow-sm" data-testid="template-editor-card">
          <CardContent className="space-y-6 p-6">
            <div className="grid gap-4 md:grid-cols-2" data-testid="template-top-fields">
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
            </div>

            <div className="space-y-6" data-testid="template-sections-stack">
              {editableTemplate.sections.map((section) => (
                <Card key={section.id} className="border-slate-200" data-testid={`template-section-card-${section.id}`}>
                  <CardHeader className="space-y-3 border-b border-slate-100 bg-slate-50/70">
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
                  </CardHeader>

                  <CardContent className="space-y-4 p-4">
                    <div className="flex flex-wrap items-center gap-2" data-testid={`template-section-variable-actions-${section.id}`}>
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
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateSection(section.id, (prev) => ({
                            ...prev,
                            subsections: [...(prev.subsections || []), createNewSubsection()],
                          }))
                        }
                        disabled={!canManageTemplates}
                        data-testid={`template-section-add-subsection-${section.id}`}
                      >
                        Add Subsection
                      </Button>
                    </div>

                    {(section.variables || []).map((variable, variableIndex) => (
                      <div
                        key={`${section.id}-var-${variableIndex}`}
                        className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1fr_1fr_200px_1fr_auto]"
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

                    {(section.subsections || []).map((subsection, subsectionIndex) => (
                      <div
                        key={subsection.id}
                        className="space-y-3 rounded-md border border-slate-200 bg-white p-3"
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
                          className="min-h-20 font-mono text-sm"
                          data-testid={`template-subsection-textarea-${section.id}-${subsection.id}`}
                        />

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
                          Add Subsection Variable
                        </Button>

                        {(subsection.variables || []).map((variable, variableIndex) => (
                          <div
                            key={`${subsection.id}-var-${variableIndex}`}
                            className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-2 md:grid-cols-[1fr_1fr_180px_1fr_auto]"
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
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TemplatesPage;
