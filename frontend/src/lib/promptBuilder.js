const VARIABLE_REGEX = /\{\s*([^{}]+?)\s*\}/g;

const normalizeVariableKey = (key = "") => key.trim().toLowerCase();

const resolveVariableValue = (values = {}, key = "") => {
  const exactValue = values[key];
  if (typeof exactValue === "string" && exactValue.trim()) {
    return exactValue.trim();
  }

  const targetKey = normalizeVariableKey(key);
  const fallbackEntry = Object.entries(values).find(
    ([candidateKey, candidateValue]) =>
      normalizeVariableKey(candidateKey) === targetKey &&
      typeof candidateValue === "string" &&
      candidateValue.trim(),
  );

  return fallbackEntry ? fallbackEntry[1].trim() : "";
};

export const extractVariableKeysFromText = (rawText = "") => {
  const keys = [];
  const keySet = new Set();
  let match = VARIABLE_REGEX.exec(rawText);

  while (match !== null) {
    const key = match[1]?.trim();
    if (key && !keySet.has(key)) {
      keySet.add(key);
      keys.push(key);
    }
    match = VARIABLE_REGEX.exec(rawText);
  }

  VARIABLE_REGEX.lastIndex = 0;
  return keys;
};

const mergeVariableDefaults = (definitions = [], rawText = "") => {
  const textKeys = extractVariableKeysFromText(rawText);
  const values = {};
  const normalizedKeys = new Set();

  definitions.forEach((definition) => {
    const normalizedKey = normalizeVariableKey(definition.key);
    if (!normalizedKeys.has(normalizedKey)) {
      values[definition.key] = definition.default_value || "";
      normalizedKeys.add(normalizedKey);
    }
  });

  textKeys.forEach((key) => {
    const normalizedKey = normalizeVariableKey(key);
    if (!normalizedKeys.has(normalizedKey)) {
      values[key] = "";
      normalizedKeys.add(normalizedKey);
    }
  });

  return values;
};

export const syncVariableValuesFromText = (rawText = "", variableValues = {}) => {
  const nextValues = { ...variableValues };
  const textKeys = extractVariableKeysFromText(rawText);
  const existingKeys = Object.keys(nextValues);

  textKeys.forEach((key) => {
    const hasCaseInsensitiveMatch = existingKeys.some(
      (existingKey) => normalizeVariableKey(existingKey) === normalizeVariableKey(key),
    );

    if (!hasCaseInsensitiveMatch) {
      nextValues[key] = "";
    }
  });

  return nextValues;
};

export const createBuilderSectionsFromTemplates = (templates = []) =>
  templates.map((template) => ({
    id: template.id,
    name: template.name,
    enabled: Boolean(template.enabled_by_default),
    raw_text: template.template_text,
    variable_definitions: template.variables || [],
    variable_values: mergeVariableDefaults(template.variables, template.template_text),
    subsections: (template.subsections || []).map((subsection) => ({
      id: subsection.id,
      title: subsection.title,
      enabled: Boolean(subsection.enabled_by_default),
      raw_text: subsection.template_text,
      variable_definitions: subsection.variables || [],
      variable_values: mergeVariableDefaults(subsection.variables, subsection.template_text),
    })),
  }));

export const fillTemplate = (rawText = "", values = {}) =>
  rawText.replace(VARIABLE_REGEX, (_, key) => {
    const trimmedKey = key.trim();
    const value = resolveVariableValue(values, trimmedKey);
    return value ? value : `{${trimmedKey}}`;
  });

export const compilePromptOutput = (sections = []) => {
  const snippets = {};
  const parts = [];

  sections.forEach((section) => {
    if (!section.enabled) {
      return;
    }

    const chunkParts = [];
    const sectionText = fillTemplate(section.raw_text, section.variable_values).trim();

    if (sectionText) {
      chunkParts.push(sectionText);
    }

    (section.subsections || []).forEach((subsection) => {
      if (!subsection.enabled) {
        return;
      }

      const subsectionText = fillTemplate(subsection.raw_text, subsection.variable_values).trim();
      if (subsectionText) {
        chunkParts.push(subsectionText);
      }
    });

    if (chunkParts.length > 0) {
      const sectionOutput = chunkParts.join("\n\n");
      snippets[section.id] = sectionOutput;
      parts.push(sectionOutput);
    }
  });

  return {
    compiledPrompt: parts.join("\n\n").trim(),
    sectionSnippets: snippets,
  };
};

export const getMissingRequiredVariables = (sections = []) => {
  const missing = [];

  sections
    .filter((section) => section.enabled)
    .forEach((section) => {
      (section.variable_definitions || [])
        .filter((definition) => definition.required)
        .forEach((definition) => {
          const value = section.variable_values?.[definition.key] || "";
          if (!value.trim()) {
            missing.push(`${section.name} → ${definition.label || definition.key}`);
          }
        });

      (section.subsections || [])
        .filter((subsection) => subsection.enabled)
        .forEach((subsection) => {
          (subsection.variable_definitions || [])
            .filter((definition) => definition.required)
            .forEach((definition) => {
              const value = subsection.variable_values?.[definition.key] || "";
              if (!value.trim()) {
                missing.push(`${section.name} / ${subsection.title} → ${definition.label || definition.key}`);
              }
            });
        });
    });

  return missing;
};

export const hydrateDraftSectionsFromTemplates = (draftSections = [], templates = []) => {
  const templateMap = templates.reduce((accumulator, template) => {
    accumulator[template.id] = template;
    return accumulator;
  }, {});

  return draftSections.map((section) => {
    const template = templateMap[section.id];

    return {
      ...section,
      variable_definitions: template?.variables || section.variable_definitions || [],
      subsections: (section.subsections || []).map((subsection) => {
        const templateSubsection = (template?.subsections || []).find((item) => item.id === subsection.id);

        return {
          ...subsection,
          variable_definitions: templateSubsection?.variables || subsection.variable_definitions || [],
        };
      }),
    };
  });
};
