import { Fragment } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PLACEHOLDER_REGEX = /(\{\s*[a-zA-Z0-9_.-]+\s*\})/g;

const TemplateLine = ({ text, variableValues, activeVariable }) => {
  const parts = text.split(PLACEHOLDER_REGEX);

  return parts.map((part, index) => {
    const isPlaceholder = part.startsWith("{") && part.endsWith("}");

    if (!isPlaceholder) {
      return <Fragment key={`${part}-${index}`}>{part}</Fragment>;
    }

    const variableKey = part.replace(/[{}\s]/g, "");
    const resolvedValue = variableValues[variableKey]?.trim() || `{${variableKey}}`;
    const isActive = activeVariable === variableKey;

    return (
      <span
        key={`${variableKey}-${index}`}
        className={[
          "rounded px-1",
          isActive ? "bg-indigo-100 font-semibold text-indigo-700" : "bg-transparent text-slate-900",
        ].join(" ")}
        data-testid={`preview-variable-${variableKey}`}
      >
        {resolvedValue}
      </span>
    );
  });
};

export const PreviewPane = ({ metadata, sections, compiledPrompt, activeVariable }) => {
  const enabledSections = sections.filter((section) => section.enabled);

  return (
    <div className="pane-scroll space-y-6" data-testid="preview-pane-container">
      <Card className="border-slate-200 shadow-sm" data-testid="preview-summary-card">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-slate-900" data-testid="preview-summary-title">
            Live Prompt Preview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div data-testid="preview-summary-title-value">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Prompt Title</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{metadata.title || "Untitled prompt"}</p>
            </div>
            <div data-testid="preview-summary-customer-value">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Customer</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{metadata.customer_name || "Not specified"}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2" data-testid="preview-summary-badges">
            <Badge className="bg-indigo-100 text-indigo-700" data-testid="preview-enabled-sections-badge">
              {enabledSections.length} active sections
            </Badge>
            <Badge className="bg-slate-100 text-slate-700" data-testid="preview-character-count-badge">
              {compiledPrompt.length} chars
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4" data-testid="preview-section-stack">
        {enabledSections.map((section) => (
          <Card
            key={section.id}
            className="overflow-hidden border-slate-200 bg-white shadow-sm"
            data-testid={`preview-section-card-${section.id}`}
          >
            <CardHeader className="border-b border-slate-100 bg-slate-50/70 py-4">
              <CardTitle className="text-base font-bold text-slate-900" data-testid={`preview-section-title-${section.id}`}>
                {section.name}
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4 p-5">
              <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-slate-900" data-testid={`preview-section-main-text-${section.id}`}>
                  <TemplateLine text={section.raw_text} variableValues={section.variable_values} activeVariable={activeVariable} />
                </div>
              </div>

              {section.subsections
                .filter((subsection) => subsection.enabled)
                .map((subsection) => (
                  <div
                    key={subsection.id}
                    className="rounded-lg border border-slate-200 bg-white p-4"
                    data-testid={`preview-subsection-card-${section.id}-${subsection.id}`}
                  >
                    <p
                      className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500"
                      data-testid={`preview-subsection-title-${section.id}-${subsection.id}`}
                    >
                      {subsection.title}
                    </p>
                    <div
                      className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-slate-900"
                      data-testid={`preview-subsection-text-${section.id}-${subsection.id}`}
                    >
                      <TemplateLine
                        text={subsection.raw_text}
                        variableValues={subsection.variable_values}
                        activeVariable={activeVariable}
                      />
                    </div>
                  </div>
                ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {enabledSections.length === 0 && (
        <div
          className="noise-overlay rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center"
          data-testid="preview-empty-state"
        >
          <p className="text-base font-semibold text-slate-800">No sections are enabled yet.</p>
          <p className="mt-2 text-sm text-slate-600">Enable at least one section from the builder to render a compiled prompt.</p>
        </div>
      )}
    </div>
  );
};
