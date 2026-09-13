# TypeScript-Migration priorisieren

Der Build kompiliert bereits mit `strict: true`, aber nur TypeScript: `allowJs` ist nötig für die klassischen Skripte, `checkJs` bleibt aus. Von rund 9.100 Zeilen ausführbarem `src/`-Code liegen rund 3.240 Zeilen (etwa 36 %) in TypeScript; `contracts.d.ts` beschreibt zusätzlich die gemeinsamen globalen Verträge.

Simulation, Welt, Content, Effekte, Persistenz und Karten sind migriert. Offen sind Anwendungs-/UI-Code (rund 2.600 Zeilen) sowie Renderer einschließlich Modellskripten (rund 3.200 Zeilen). Damit fehlt der Typnachweis gerade an den globalen Übergängen zwischen Simulation, UI und Darstellung; ein erfolgreicher Build prüft diese JavaScript-Dateien nicht.

## Entscheidung und nächster Schnitt

Keine breite Umstellung als Nebenarbeit. Vor einer Fortsetzung einen kleinen, zusammenhängenden Schnitt auswählen und dessen klassische Ladegruppe, globale Verträge sowie Harness-Registrierung prüfen. Sinnvolle Kandidaten sind:

1. UI als geschlossene Gruppe (`src/ui/`), wenn dort ohnehin fachliche Änderungen anstehen.
2. Nicht-generierte Renderer-Infrastruktur, erst nach Abgrenzung von Modell- und Assetpflege.
3. Verbleibende JavaScript-Dateien nur mit einem realen Änderungsanlass; `checkJs` nicht global einschalten, solange diese nicht dafür vorbereitet sind.

Für den gewählten Schnitt `strict` beibehalten, den Build und die betroffenen Tests ausführen. Keine Änderungen an Skriptreihenfolge, `file://`-Auslieferung oder globalem Laufzeitvertrag ohne eigenen Nachweis. Nach einem ersten Schnitt Aufwand und Typnutzen neu bewerten, statt eine Vollmigration vorab festzuschreiben.
