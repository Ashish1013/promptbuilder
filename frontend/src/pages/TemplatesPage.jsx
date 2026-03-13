import { useEffect, useState } from "react";
import { toast } from "@/components/ui/sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { fetchTemplates, updateTemplateSection } from "@/lib/api";

const TemplatesPage = ({ role }) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState("");
  const [editableTemplate, setEditableTemplate] = useState(null);
  const [saving, setSaving] = useState(false);

  const isAdmin = role === "admin";

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await fetchTemplates();
      setTemplates(response);
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Unable to load templates.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const startEdit = (template) => {
    setEditingId(template.id);
    setEditableTemplate(JSON.parse(JSON.stringify(template)));
  };

  const cancelEdit = () => {
    setEditingId("");
    setEditableTemplate(null);
  };

  const saveEdit = async () => {
    if (!editableTemplate) {
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: editableTemplate.name,
        description: editableTemplate.description,
        template_text: editableTemplate.template_text,
        variables: editableTemplate.variables,
        subsections: editableTemplate.subsections,
        enabled_by_default: editableTemplate.enabled_by_default,
      };

      const updated = await updateTemplateSection(editableTemplate.id, payload, role);
      setTemplates((prev) => prev.map((template) => (template.id === updated.id ? updated : template)));
      toast.success("Template section updated.");
      cancelEdit();
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Unable to update template section.");
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
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3" data-testid="templates-page-header">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500" data-testid="templates-eyebrow">
            Global Section Templates
          </p>
          <h2 className="mt-1 text-3xl font-bold text-slate-900" data-testid="templates-main-title">
            Template Library
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600" data-testid="templates-page-description">
            Admins can refine the global templates and subsection raw text here. Changes immediately impact new prompts.
          </p>
        </div>
        <Badge className="bg-slate-100 text-slate-700" data-testid="templates-role-badge">
          Active Role: {role}
        </Badge>
      </div>

      {!isAdmin && (
        <div
          className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800"
          data-testid="templates-readonly-banner"
        >
          You are in read-only mode. Switch to admin role to edit templates.
        </div>
      )}

      <div className="space-y-6" data-testid="templates-card-stack">
        {templates.map((template) => {
          const isEditing = editingId === template.id;
          const currentTemplate = isEditing ? editableTemplate : template;

          return (
            <Card key={template.id} className="border-slate-200 shadow-sm" data-testid={`template-card-${template.id}`}>
              <CardHeader className="border-b border-slate-100 bg-slate-50/70">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl font-bold text-slate-900" data-testid={`template-title-${template.id}`}>
                      {template.name}
                    </CardTitle>
                    <p className="mt-1 text-sm text-slate-600" data-testid={`template-description-${template.id}`}>
                      {template.description}
                    </p>
                  </div>

                  {isAdmin && !isEditing && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => startEdit(template)}
                      data-testid={`template-edit-button-${template.id}`}
                    >
                      Edit Section
                    </Button>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-5 p-6">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500" data-testid={`template-raw-label-${template.id}`}>
                    Section Raw Template
                  </p>
                  <Textarea
                    value={currentTemplate?.template_text || ""}
                    disabled={!isEditing}
                    onChange={(event) =>
                      setEditableTemplate((prev) => ({
                        ...prev,
                        template_text: event.target.value,
                      }))
                    }
                    className="min-h-36 bg-slate-50 font-mono text-sm"
                    data-testid={`template-raw-textarea-${template.id}`}
                  />
                </div>

                <div className="space-y-2" data-testid={`template-variable-block-${template.id}`}>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Variables</p>
                  <div className="flex flex-wrap gap-2">
                    {(currentTemplate?.variables || []).map((variable) => (
                      <Badge
                        key={`${template.id}-${variable.key}`}
                        className="bg-indigo-100 text-indigo-700"
                        data-testid={`template-variable-badge-${template.id}-${variable.key}`}
                      >
                        {variable.key}
                      </Badge>
                    ))}
                  </div>
                </div>

                {(currentTemplate?.subsections || []).length > 0 && (
                  <div className="space-y-4" data-testid={`template-subsection-stack-${template.id}`}>
                    <p className="text-sm font-semibold text-slate-800">Subsections</p>
                    {currentTemplate.subsections.map((subsection, index) => (
                      <div
                        key={subsection.id}
                        className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/60 p-4"
                        data-testid={`template-subsection-card-${template.id}-${subsection.id}`}
                      >
                        <p className="text-sm font-semibold text-slate-900" data-testid={`template-subsection-title-${template.id}-${subsection.id}`}>
                          {subsection.title}
                        </p>
                        <Textarea
                          value={subsection.template_text}
                          disabled={!isEditing}
                          onChange={(event) =>
                            setEditableTemplate((prev) => {
                              const nextSubsections = prev.subsections.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, template_text: event.target.value } : item,
                              );
                              return { ...prev, subsections: nextSubsections };
                            })
                          }
                          className="min-h-24 bg-white font-mono text-sm"
                          data-testid={`template-subsection-textarea-${template.id}-${subsection.id}`}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {isEditing && (
                  <div className="flex flex-wrap items-center justify-end gap-2" data-testid={`template-edit-actions-${template.id}`}>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={cancelEdit}
                      data-testid={`template-cancel-button-${template.id}`}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={saveEdit}
                      disabled={saving}
                      data-testid={`template-save-button-${template.id}`}
                    >
                      {saving ? "Saving..." : "Save Template"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default TemplatesPage;
