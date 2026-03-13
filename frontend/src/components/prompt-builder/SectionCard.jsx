import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { extractVariableKeysFromText, syncVariableValuesFromText } from "@/lib/promptBuilder";

const mergeVariableKeys = (text, variableValues = {}) => {
  const textKeys = extractVariableKeysFromText(text);
  const keys = [...Object.keys(variableValues), ...textKeys];
  return [...new Set(keys)];
};

export const SectionCard = ({
  section,
  readOnly,
  activeVariable,
  onActiveVariableChange,
  onSectionUpdate,
  showSectionToggle = true,
  showSubsectionToggle = true,
  onlyShowEnabledSubsections = false,
}) => {
  const [showRawEditor, setShowRawEditor] = useState(false);
  const [subsectionRawState, setSubsectionRawState] = useState({});

  const visibleSubsections = onlyShowEnabledSubsections
    ? (section.subsections || []).filter((subsection) => subsection.enabled)
    : section.subsections || [];

  const sectionVariableKeys = useMemo(
    () => mergeVariableKeys(section.raw_text, section.variable_values),
    [section.raw_text, section.variable_values],
  );

  const updateSectionField = (field, value) => {
    onSectionUpdate({
      ...section,
      [field]: value,
    });
  };

  const updateSectionVariable = (variableKey, variableValue) => {
    onSectionUpdate({
      ...section,
      variable_values: {
        ...section.variable_values,
        [variableKey]: variableValue,
      },
    });
  };

  const updateSubsection = (subsectionId, updater) => {
    const nextSubsections = section.subsections.map((subsection) =>
      subsection.id === subsectionId ? updater(subsection) : subsection,
    );

    onSectionUpdate({
      ...section,
      subsections: nextSubsections,
    });
  };

  return (
    <Card
      className="overflow-hidden border-slate-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md"
      data-testid={`section-card-${section.id}`}
    >
      <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-lg font-bold text-slate-900" data-testid={`section-title-${section.id}`}>
              {section.name}
            </CardTitle>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500" data-testid={`section-variables-count-${section.id}`}>
              {sectionVariableKeys.length} variables · {(section.subsections || []).length} subsections
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Badge
              className={section.enabled ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600"}
              data-testid={`section-status-badge-${section.id}`}
            >
              {section.enabled ? "Enabled" : "Disabled"}
            </Badge>

            {showSectionToggle && (
              <Switch
                checked={section.enabled}
                disabled={readOnly}
                onCheckedChange={(value) => updateSectionField("enabled", value)}
                aria-label={`Toggle ${section.name}`}
                data-testid={`section-toggle-${section.id}`}
              />
            )}
          </div>
        </div>
      </CardHeader>

      {section.enabled && (
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-700" data-testid={`section-variable-title-${section.id}`}>
              Variable Inputs
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowRawEditor((prev) => !prev)}
              data-testid={`section-raw-editor-toggle-${section.id}`}
            >
              {showRawEditor ? "Hide Raw" : "Edit Raw"}
            </Button>
          </div>

          {sectionVariableKeys.length === 0 && (
            <div
              className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600"
              data-testid={`section-no-variables-${section.id}`}
            >
              No placeholders detected in this section text.
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {sectionVariableKeys.map((variableKey) => (
              <div key={`${section.id}-${variableKey}`} className="space-y-2">
                <label
                  htmlFor={`${section.id}-${variableKey}`}
                  className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500"
                  data-testid={`section-variable-label-${section.id}-${variableKey}`}
                >
                  {variableKey}
                </label>
                <Input
                  id={`${section.id}-${variableKey}`}
                  value={section.variable_values[variableKey] || ""}
                  onChange={(event) => updateSectionVariable(variableKey, event.target.value)}
                  onFocus={() => onActiveVariableChange(variableKey)}
                  onBlur={() => onActiveVariableChange("")}
                  disabled={readOnly}
                  className={activeVariable === variableKey ? "ring-2 ring-indigo-500 ring-offset-2" : ""}
                  data-testid={`section-variable-input-${section.id}-${variableKey}`}
                />
              </div>
            ))}
          </div>

          {showRawEditor && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="space-y-2"
              data-testid={`section-raw-editor-block-${section.id}`}
            >
              <label
                htmlFor={`section-raw-text-${section.id}`}
                className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500"
                data-testid={`section-raw-editor-label-${section.id}`}
              >
                Raw Section Template
              </label>
              <Textarea
                id={`section-raw-text-${section.id}`}
                value={section.raw_text}
                disabled={readOnly}
                onChange={(event) =>
                  onSectionUpdate({
                    ...section,
                    raw_text: event.target.value,
                    variable_values: syncVariableValuesFromText(event.target.value, section.variable_values),
                  })
                }
                className="min-h-36 bg-slate-50 font-mono text-sm"
                data-testid={`section-raw-editor-textarea-${section.id}`}
              />
            </motion.div>
          )}

          {visibleSubsections.length > 0 && (
            <div className="space-y-3" data-testid={`section-subsection-container-${section.id}`}>
              <p className="text-sm font-semibold text-slate-800" data-testid={`section-subsection-title-${section.id}`}>
                Subsections
              </p>

              {visibleSubsections.map((subsection) => {
                const subsectionVariableKeys = mergeVariableKeys(subsection.raw_text, subsection.variable_values);
                const rawVisible = subsectionRawState[subsection.id] || false;

                return (
                  <div
                    key={subsection.id}
                    className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/60 p-4"
                    data-testid={`subsection-card-${section.id}-${subsection.id}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900" data-testid={`subsection-title-${section.id}-${subsection.id}`}>
                          {subsection.title}
                        </h4>
                        <p
                          className="text-[11px] uppercase tracking-[0.14em] text-slate-500"
                          data-testid={`subsection-variables-count-${section.id}-${subsection.id}`}
                        >
                          {subsectionVariableKeys.length} variables
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setSubsectionRawState((prev) => ({
                              ...prev,
                              [subsection.id]: !prev[subsection.id],
                            }))
                          }
                          data-testid={`subsection-raw-toggle-${section.id}-${subsection.id}`}
                        >
                          {rawVisible ? "Hide Raw" : "Edit Raw"}
                        </Button>

                        {showSubsectionToggle && (
                          <Switch
                            checked={subsection.enabled}
                            disabled={readOnly}
                            onCheckedChange={(value) =>
                              updateSubsection(subsection.id, (current) => ({
                                ...current,
                                enabled: value,
                              }))
                            }
                            aria-label={`Toggle ${subsection.title}`}
                            data-testid={`subsection-toggle-${section.id}-${subsection.id}`}
                          />
                        )}
                      </div>
                    </div>

                    {subsection.enabled && (
                      <>
                        <div className="grid gap-3 md:grid-cols-2">
                          {subsectionVariableKeys.map((variableKey) => (
                            <div key={`${subsection.id}-${variableKey}`} className="space-y-1.5">
                              <label
                                htmlFor={`${subsection.id}-${variableKey}`}
                                className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500"
                                data-testid={`subsection-variable-label-${section.id}-${subsection.id}-${variableKey}`}
                              >
                                {variableKey}
                              </label>
                              <Input
                                id={`${subsection.id}-${variableKey}`}
                                value={subsection.variable_values[variableKey] || ""}
                                disabled={readOnly}
                                onChange={(event) =>
                                  updateSubsection(subsection.id, (current) => ({
                                    ...current,
                                    variable_values: {
                                      ...current.variable_values,
                                      [variableKey]: event.target.value,
                                    },
                                  }))
                                }
                                onFocus={() => onActiveVariableChange(variableKey)}
                                onBlur={() => onActiveVariableChange("")}
                                className={activeVariable === variableKey ? "ring-2 ring-indigo-500 ring-offset-2" : ""}
                                data-testid={`subsection-variable-input-${section.id}-${subsection.id}-${variableKey}`}
                              />
                            </div>
                          ))}
                        </div>

                        {rawVisible && (
                          <div className="space-y-2" data-testid={`subsection-raw-editor-block-${section.id}-${subsection.id}`}>
                            <label
                              htmlFor={`subsection-raw-${section.id}-${subsection.id}`}
                              className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500"
                              data-testid={`subsection-raw-editor-label-${section.id}-${subsection.id}`}
                            >
                              Raw Subsection Template
                            </label>
                            <Textarea
                              id={`subsection-raw-${section.id}-${subsection.id}`}
                              value={subsection.raw_text}
                              disabled={readOnly}
                              onChange={(event) =>
                                updateSubsection(subsection.id, (current) => ({
                                  ...current,
                                  raw_text: event.target.value,
                                  variable_values: syncVariableValuesFromText(event.target.value, current.variable_values),
                                }))
                              }
                              className="min-h-28 bg-white font-mono text-sm"
                              data-testid={`subsection-raw-editor-textarea-${section.id}-${subsection.id}`}
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};
