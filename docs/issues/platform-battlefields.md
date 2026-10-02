# Technische Plattformkarten: erste Abnahme und Ausbau

Manuell isoliert öffnen: `index.html?experiment=platform-deck&seed=1409`.
Der Prototyp bleibt bis zur Abnahme außerhalb zufälliger Expeditionen; Naturkarten und bisheriges Mothership werden nicht ersetzt. [Weltvertrag](../architecture.md#weltrezepte-und-feste-designs), [Darstellung](../rendering.md#texturen-und-portraits).

- [ ] Nutzerfeedback zu seedabhängigen Raumaufteilungen, Rechteck-/L-Mitteldecks, darauf sitzenden Hochdecks, Rampen und Stahloberflächen einholen. Keine direkte Boden→Hochdeck-Verbindung und keine vier slotgebundenen Startplattformen. Gleichwertige Vielfalt gegenüber Naturkarten bleibt visuell zu beurteilen; keine fertige Sammlung von Schiffs-/Stadtrezepten behaupten.
- [ ] Rampenmündungen, große Fahrzeuge, Ausfahrten, Ressourcenarbeit und Höhen-Sichtstufen menschlich spielen; konservative CPU-Klippenränder gegenüber scharfen Wandskins/Picking beurteilen. Keine übereinanderliegenden begehbaren Decks.
- [ ] Zwei-/Vierparteienstarts sowie zusätzliche Seeds gezielt abnehmen; keine Balance-/Allseedgarantie aus dem ersten CPU-Fall ableiten. KI-/Simulationsprüfungen nur nach separater Freigabe.
- [ ] Nach Formabnahme zusätzliche Verbindungs-/Raumrezepte und alternative Mitteldeck→Hochdeck-Zugänge ergänzen; Engpassdichte und Bauplatzangebot beurteilen. Technische Maschinenbereiche müssen sichtbare Blocker und CPU-Sperren gemeinsam planen; Rampen-/Bauflächen freihalten.
- [ ] Erst danach getrennte Schiffs-/Stadtprofile mit passenden Wand-/Bodenmaterialien und erlaubten Dekorfamilien ergänzen; Vegetation nur in expliziten Stadt-Grünflächen. Keine beliebige Kombination von Material und Generator.
- [ ] Entscheidung über Aufnahme in Expeditionen bzw. künftige Mothership-Geometrie erst nach Feedback und Spielabnahme. Initialisierungszeit/Performance auf Zielgeräten bleiben offen.

Begrenzter Prüfkontext: ein CPU-Weltfall mit vier Parteien, Fahrzeugfreiraum einschließlich Rampenmündungen, Bauverbot auf Rampen und begehbare Ressourcenflächen; Plan-Mesh mit endlichen Flächennormalen und reine Planproben verschiedener Seeds. Der tatsächliche isolierte Experimentstart mit Seed `1409` wurde lokal über `file://` in Chromium einschließlich Missionsfreigabe/Entitätserzeugung geöffnet; keine vollständige Gefechts-/KI-Abnahme. Die zusätzlichen Ansichten von Seed `3` sind arrangierte Menüvorschauen mit Mittagslicht, keine Echtgeräteabnahme.
