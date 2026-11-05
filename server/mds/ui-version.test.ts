import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
const source = readFileSync(
  new URL(
    "../../client/src/components/mds/private-artisan-requests.tsx",
    import.meta.url
  ),
  "utf8"
);
describe("formulaire artisan lié à son contexte d’ouverture", () => {
  it("remonte uniquement sur un contexte serveur identifié incluant sa version", () => {
    expect(source).toContain(
      "key={`${request.id}-${request.version}-${action}`}"
    );
  });
  it("soumet la version capturée à l’ouverture plutôt que de réarmer des anciens champs", () => {
    const form = source.split("function ActionForm(")[1];
    expect(form).toMatch(/\[openedVersion\]\s*=\s*useState\(request.version\)/);
    expect(form).toContain("version: openedVersion");
    expect(form).not.toContain("version: request.version");
  });
});
