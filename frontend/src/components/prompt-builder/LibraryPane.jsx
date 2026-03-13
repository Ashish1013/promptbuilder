import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export const LibraryPane = ({
  sections,
  readOnly,
  searchQuery,
  onSearchChange,
  onSectionToggle,
  onSubsectionToggle,
}) => {
  const filteredSections = sections.filter((section) => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) {
      return true;
    }

    const sectionMatch = section.name.toLowerCase().includes(keyword);
    const subsectionMatch = (section.subsections || []).some((subsection) =>
      subsection.title.toLowerCase().includes(keyword),
    );

    return sectionMatch || subsectionMatch;
  });

  return (
    <div className="space-y-5" data-testid="library-pane-root">
      <div className="space-y-3" data-testid="library-pane-header">
        <p
          className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500"
          data-testid="library-pane-eyebrow"
        >
          Section Library
        </p>
        <h2 className="text-2xl font-bold text-slate-900" data-testid="library-pane-title">
          Choose Prompt Sections
        </h2>
        <p className="text-sm text-slate-600" data-testid="library-pane-description">
          Select sections and subsections to bring into your working prompt.
        </p>
      </div>

      <div className="space-y-2" data-testid="library-search-block">
        <label
          htmlFor="library-search-input"
          className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500"
          data-testid="library-search-label"
        >
          Search Sections
        </label>
        <Input
          id="library-search-input"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search persona, language, guardrails..."
          data-testid="library-search-input"
        />
      </div>

      <div className="flex items-center gap-2" data-testid="library-stats-block">
        <Badge className="bg-indigo-100 text-indigo-700" data-testid="library-active-sections-badge">
          {sections.filter((section) => section.enabled).length}/{sections.length} sections selected
        </Badge>
      </div>

      <div className="space-y-4" data-testid="library-sections-list">
        {filteredSections.map((section) => (
          <Card key={section.id} className="border-slate-200 bg-white shadow-sm" data-testid={`library-section-card-${section.id}`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <CardTitle className="text-base font-bold text-slate-900" data-testid={`library-section-title-${section.id}`}>
                    {section.name}
                  </CardTitle>
                  <p
                    className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500"
                    data-testid={`library-section-meta-${section.id}`}
                  >
                    {(section.subsections || []).filter((subsection) => subsection.enabled).length}/
                    {(section.subsections || []).length} subsections selected
                  </p>
                </div>

                <Switch
                  checked={section.enabled}
                  disabled={readOnly}
                  onCheckedChange={(value) => onSectionToggle(section.id, value)}
                  aria-label={`Toggle ${section.name}`}
                  data-testid={`library-section-toggle-${section.id}`}
                />
              </div>
            </CardHeader>

            <CardContent className="space-y-2 pt-0">
              {(section.subsections || []).length === 0 && (
                <p className="text-xs text-slate-500" data-testid={`library-section-no-subsections-${section.id}`}>
                  No subsections configured.
                </p>
              )}

              {(section.subsections || []).map((subsection) => (
                <div
                  key={subsection.id}
                  className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
                  data-testid={`library-subsection-row-${section.id}-${subsection.id}`}
                >
                  <p
                    className="text-sm font-medium text-slate-700"
                    data-testid={`library-subsection-title-${section.id}-${subsection.id}`}
                  >
                    {subsection.title}
                  </p>
                  <Switch
                    checked={subsection.enabled}
                    disabled={!section.enabled || readOnly}
                    onCheckedChange={(value) => onSubsectionToggle(section.id, subsection.id, value)}
                    aria-label={`Toggle ${subsection.title}`}
                    data-testid={`library-subsection-toggle-${section.id}-${subsection.id}`}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

        {filteredSections.length === 0 && (
          <div
            className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8 text-center"
            data-testid="library-empty-search-state"
          >
            <p className="text-sm font-semibold text-slate-700">No matching sections found.</p>
          </div>
        )}
      </div>
    </div>
  );
};
