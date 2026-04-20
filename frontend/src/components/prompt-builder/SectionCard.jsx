import { useState } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { extractVariableKeysFromText, syncVariableValuesFromText } from "@/lib/promptBuilder";

const mergeVariableKeys = (text) => {
  const textKeys = extractVariableKeysFromText(text);
  return [...new Set(textKeys)];
};

const getDefinitionMap = (definitions = []) =>
  definitions.reduce((accumulator, definition) => {
    accumulator[definition.key] = definition;
    return accumulator;
  }, {});

const getDefinitionByKey = (definitionMap = {}, variableKey = "") => {
  if (definitionMap[variableKey]) {
    return definitionMap[variableKey];
  }

  const normalizedKey = variableKey.trim().toLowerCase();
  const match = Object.keys(definitionMap).find((candidateKey) => candidateKey.trim().toLowerCase() === normalizedKey);
  return match ? definitionMap[match] : null;
};

const parseMultiSelectValue = (value = "") =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

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

  const sectionDefinitionMap = getDefinitionMap(section.variable_definitions || []);
  const sectionVariableKeys = mergeVariableKeys(section.raw_text);

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

          <div className="grid gap-4 xl:grid-cols-2">
            {sectionVariableKeys.map((variableKey) => (
              <div key={`${section.id}-${variableKey}`} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/40 p-3">
                {(() => {
                  const variableDefinition = getDefinitionByKey(sectionDefinitionMap, variableKey);

                  return (
                    <>
                <label
                  htmlFor={`${section.id}-${variableKey}`}
                  className="text-sm font-semibold text-slate-800"
                  data-testid={`section-variable-label-${section.id}-${variableKey}`}
                >
                  {variableKey}
                </label>
                {variableDefinition?.label && variableDefinition?.label !== variableKey && (
                  <p className="text-xs text-slate-500" data-testid={`section-variable-help-${section.id}-${variableKey}`}>
                    {variableDefinition?.label}
                  </p>
                )}
                <p className="text-[11px] text-slate-500" data-testid={`section-variable-meta-${section.id}-${variableKey}`}>
                  {variableDefinition?.required ? "Required" : "Optional"}
                </p>

                {variableDefinition?.input_type === "textarea" && (
                  <Textarea
                    id={`${section.id}-${variableKey}`}
                    value={section.variable_values[variableKey] || ""}
                    onChange={(event) => updateSectionVariable(variableKey, event.target.value)}
                    onFocus={() => onActiveVariableChange(variableKey)}
                    onBlur={() => onActiveVariableChange("")}
                    disabled={readOnly}
                    className={`min-h-32 resize-y bg-white ${activeVariable === variableKey ? "ring-2 ring-indigo-500 ring-offset-2" : ""}`}
                    data-testid={`section-variable-input-${section.id}-${variableKey}`}
                  />
                )}

                {variableDefinition?.input_type === "select" && (
                  <select
                    id={`${section.id}-${variableKey}`}
                    value={section.variable_values[variableKey] || ""}
                    onChange={(event) => updateSectionVariable(variableKey, event.target.value)}
                    onFocus={() => onActiveVariableChange(variableKey)}
                    onBlur={() => onActiveVariableChange("")}
                    disabled={readOnly}
                    className={`h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm ${activeVariable === variableKey ? "ring-2 ring-indigo-500 ring-offset-2" : ""}`}
                    data-testid={`section-variable-input-${section.id}-${variableKey}`}
                  >
                    {(variableDefinition?.options || []).map((option) => (
                      <option key={`${section.id}-${variableKey}-${option}`} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                )}

                {variableDefinition?.input_type === "multiselect" && (
                  <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-2" data-testid={`section-multiselect-${section.id}-${variableKey}`}>
                    {(variableDefinition?.options || []).map((option) => {
                      const selectedValues = parseMultiSelectValue(section.variable_values[variableKey] || "");
                      const isSelected = selectedValues.includes(option);

                      return (
                        <label
                          key={`${section.id}-${variableKey}-${option}`}
                          className="flex items-center gap-2 text-sm text-slate-700"
                          data-testid={`section-multiselect-option-${section.id}-${variableKey}-${option}`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={readOnly}
                            onChange={(event) => {
                              const nextValues = event.target.checked
                                ? [...selectedValues, option]
                                : selectedValues.filter((item) => item !== option);
                              updateSectionVariable(variableKey, nextValues.join(", "));
                            }}
                            onFocus={() => onActiveVariableChange(variableKey)}
                            onBlur={() => onActiveVariableChange("")}
                            data-testid={`section-multiselect-checkbox-${section.id}-${variableKey}-${option}`}
                          />
                          {option}
                        </label>
                      );
                    })}
                  </div>
                )}

                {(!variableDefinition?.input_type || variableDefinition?.input_type === "text") && (
                  <Textarea
                    id={`${section.id}-${variableKey}`}
                    value={section.variable_values[variableKey] || ""}
                    onChange={(event) => updateSectionVariable(variableKey, event.target.value)}
                    onFocus={() => onActiveVariableChange(variableKey)}
                    onBlur={() => onActiveVariableChange("")}
                    disabled={readOnly}
                    className={`min-h-24 resize-y bg-white ${activeVariable === variableKey ? "ring-2 ring-indigo-500 ring-offset-2" : ""}`}
                    data-testid={`section-variable-input-${section.id}-${variableKey}`}
                  />
                )}
                    </>
                  );
                })()}
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
                const subsectionDefinitionMap = getDefinitionMap(subsection.variable_definitions || []);
                const subsectionVariableKeys = mergeVariableKeys(subsection.raw_text);
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
                        <div className="grid gap-3 xl:grid-cols-2">
                          {subsectionVariableKeys.map((variableKey) => (
                            <div
                              key={`${subsection.id}-${variableKey}`}
                              className="space-y-2 rounded-md border border-slate-200 bg-white p-3"
                            >
                              {(() => {
                                const variableDefinition = getDefinitionByKey(subsectionDefinitionMap, variableKey);

                                return (
                                  <>
                              <label
                                htmlFor={`${subsection.id}-${variableKey}`}
                                className="text-sm font-semibold text-slate-800"
                                data-testid={`subsection-variable-label-${section.id}-${subsection.id}-${variableKey}`}
                              >
                                {variableKey}
                              </label>
                              {variableDefinition?.label && variableDefinition?.label !== variableKey && (
                                  <p
                                    className="text-xs text-slate-500"
                                    data-testid={`subsection-variable-help-${section.id}-${subsection.id}-${variableKey}`}
                                  >
                                    {variableDefinition?.label}
                                  </p>
                                )}
                              {variableDefinition?.input_type === "textarea" && (
                                <Textarea
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
                                  className={`min-h-20 ${activeVariable === variableKey ? "ring-2 ring-indigo-500 ring-offset-2" : ""}`}
                                  data-testid={`subsection-variable-input-${section.id}-${subsection.id}-${variableKey}`}
                                />
                              )}

                              {variableDefinition?.input_type === "select" && (
                                <select
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
                                  className={`h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm ${activeVariable === variableKey ? "ring-2 ring-indigo-500 ring-offset-2" : ""}`}
                                  data-testid={`subsection-variable-input-${section.id}-${subsection.id}-${variableKey}`}
                                >
                                  {(variableDefinition?.options || []).map((option) => (
                                    <option key={`${subsection.id}-${variableKey}-${option}`} value={option}>
                                      {option}
                                    </option>
                                  ))}
                                </select>
                              )}

                              {variableDefinition?.input_type === "multiselect" && (
                                <div
                                  className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-2"
                                  data-testid={`subsection-multiselect-${section.id}-${subsection.id}-${variableKey}`}
                                >
                                  {(variableDefinition?.options || []).map((option) => {
                                    const selectedValues = parseMultiSelectValue(subsection.variable_values[variableKey] || "");
                                    const isSelected = selectedValues.includes(option);

                                    return (
                                      <label
                                        key={`${subsection.id}-${variableKey}-${option}`}
                                        className="flex items-center gap-2 text-sm text-slate-700"
                                        data-testid={`subsection-multiselect-option-${section.id}-${subsection.id}-${variableKey}-${option}`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          disabled={readOnly}
                                          onChange={(event) => {
                                            const nextValues = event.target.checked
                                              ? [...selectedValues, option]
                                              : selectedValues.filter((item) => item !== option);

                                            updateSubsection(subsection.id, (current) => ({
                                              ...current,
                                              variable_values: {
                                                ...current.variable_values,
                                                [variableKey]: nextValues.join(", "),
                                              },
                                            }));
                                          }}
                                          onFocus={() => onActiveVariableChange(variableKey)}
                                          onBlur={() => onActiveVariableChange("")}
                                          data-testid={`subsection-multiselect-checkbox-${section.id}-${subsection.id}-${variableKey}-${option}`}
                                        />
                                        {option}
                                      </label>
                                    );
                                  })}
                                </div>
                              )}

                              {(!variableDefinition?.input_type || variableDefinition?.input_type === "text") && (
                                <Textarea
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
                                  className={`min-h-24 resize-y bg-white ${activeVariable === variableKey ? "ring-2 ring-indigo-500 ring-offset-2" : ""}`}
                                  data-testid={`subsection-variable-input-${section.id}-${subsection.id}-${variableKey}`}
                                />
                              )}
                                  </>
                                );
                              })()}
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
