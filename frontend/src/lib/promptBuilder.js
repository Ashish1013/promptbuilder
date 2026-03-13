const VARIABLE_REGEX = /\{\s*([a-zA-Z0-9_.-]+)\s*\}/g;

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

  definitions.forEach((definition) => {
    values[definition.key] = definition.default_value || "";
  });

  textKeys.forEach((key) => {
    if (!(key in values)) {
      values[key] = "";
    }
  });

  return values;
};

export const syncVariableValuesFromText = (rawText = "", variableValues = {}) => {
  const nextValues = { ...variableValues };
  const textKeys = extractVariableKeysFromText(rawText);

  textKeys.forEach((key) => {
    if (!(key in nextValues)) {
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
    variable_values: mergeVariableDefaults(template.variables, template.template_text),
    subsections: (template.subsections || []).map((subsection) => ({
      id: subsection.id,
      title: subsection.title,
      enabled: Boolean(subsection.enabled_by_default),
      raw_text: subsection.template_text,
      variable_values: mergeVariableDefaults(subsection.variables, subsection.template_text),
    })),
  }));

export const fillTemplate = (rawText = "", values = {}) =>
  rawText.replace(VARIABLE_REGEX, (_, key) => {
    const trimmedKey = key.trim();
    const value = values[trimmedKey];
    return value && value.trim() ? value : `{${trimmedKey}}`;
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
