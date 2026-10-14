# Assets und Modelle pflegen

Gestalterische Ziele: [Grafik-Leitlinie](graphics-guideline.md).
Registrierung, Parameter und lokale Darstellungsverträge stehen im Code.

## Modelle und Oberflächen

Einheiten-/Gebäudemodelle haben TypeScript als maßgebliche Quelle. Geometrie,
Registrierung und Animation gehören in die eigene Modelldatei; gemeinsame Helfer
enthalten keine modellspezifischen Daten. Meshfabriken sind synchron, werten Content
nicht früh aus und erzeugen Geometrie nicht pro Frame. Modelle zeichnen über ihren
Kontext, ohne direkten GPU- oder Simulationszugriff. Neue Dateien gemäß
[Ladevertrag](architecture.md#auslieferung) einbinden.

Gemeinsamer Adapter besitzt Gelände-/Gebäudepose, Ghost-/Previewtönung und
Standardfundamente. Zivile Decks, Treppen und Ausbauhüllen teilen ihre Geometrie mit
CPU-Platzierung; keine parallele Stützen-/Eingangslogik. Visuelle Bodenauffüllung
ist kein Terraforming und verändert keine Navigation.

Gemeinsame Materialien nicht für ein einzelnes Modell ändern. Vertexkanäle haben
materialabhängige Bedeutung; der Alphakanal opaker Rastermaterialien trägt Mikrohöhe,
nicht Transparenz. Lampen über den Modellkontext melden, nicht durch Halo-Meshes ersetzen.
Leihressourcen niemals als eigene freigeben; Modellkacheln nur im Rendercallback aufnehmen.

## Raster und UI

Rasterquellen ausschließlich WebP, Qualität 80, benötigtes Alpha erhalten.
Keine unbeauftragte Assetlöschung/-ersetzung. Gelände, Modelloberflächen und Himmel
sind prozedural; keine zusätzlichen Rasterassets ohne konkreten Bedarf.

UI-Motive und lokale Fonts liegen unter `assets/`. Import ausgewählter Motive:
`python3 scripts/import-menu-assets.py <pfad>/Ashes-of-Meridian-Demo.html`.
Keine Demo-Hintergründe, Audio, Fraktions-Crops oder Mockup-Logik übernehmen.
Assets im [ZIP- und Docker-Paketweg](deployment.md) gemeinsam berücksichtigen.

## Audio

`audio/` enthält nur freigegebene Laufzeitaufnahmen, keine Entwürfe. MP3s unverändert
übernehmen, nicht beim Build neu encodieren. Musikentwürfe sind separate Werkzeugarbeit.

`src/voice-content.ts` ist der maßgebliche Katalog für Zeilen-ID, Sprecher, Text und Aufnahme:

1. Aufnahme nach `audio/voices/` kopieren, Text mit ihr abgleichen und Katalog aktualisieren.
2. IDs bei gleicher Bedeutung beibehalten; Tutorial referenziert IDs, nicht Dateinamen.
   Auswahlvarianten über `SELECTION_VOICE_LINES` dem technischen Einheitentyp zuordnen.
3. Build und betroffenen Audio-Paketvertrag prüfen, Aufnahme/Katalog/Paketweg gemeinsam committen.

Fehlende Aufnahme oder Autoplayfehler dürfen Fortschritt nicht blockieren. Lokale
Medienelemente erhalten `file://` ohne `fetch` oder Sicherheitslockerung.
Wiedergaberegeln stehen in `src/audio.ts`; Aussprache und Mischung bleiben menschliche Abnahme.
