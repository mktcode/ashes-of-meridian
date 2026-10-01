# Feste Testreferenzen

Fixtures schützen vor unbeabsichtigten Änderungen, nicht vor bewusst beauftragter Weiterentwicklung. **Sollwerte niemals allein deshalb neu erzeugen, weil ein Test fehlschlägt.** Erst Ursache und beabsichtigten Änderungsumfang klären; unabhängige Erwartungen und unbeteiligte Referenzen erhalten.

## Relevante Besonderheiten

- `tests/fixtures/presentation-v1.json` schützt weiterhin die Bodensamples des **unkomponierten Desert-Rezepts** sowie Effektpayloads, Lebensdauer und RNG-Folgesamples auf dessen flachem spielbaren Boden. Der Alle-Karten-Ausbau komponiert darüber ausdrücklich eine neue begehbare Oberfläche; diese wird separat mit ihren tatsächlichen Daten geprüft, nicht in historische Zeichenaufrufe zurückübersetzt. Die aktuellen Navigationsverträge werden unabhängig geprüft; die Fixture enthält keine Platzierungs-/Navigationsdigests.
- Aktuelle Kartenkompositionen werden über unabhängige Zugänglichkeit, Wiederholbarkeit, RNG-Isolation und Geometrie-/Surface-Prüfungen abgesichert. Vollständige KI-Runs ergänzen dies nur bei ausdrücklicher aktueller Freigabe; frühere Läufe bestätigen nicht automatisch neue Oberflächen. Desert prüft zusätzlich die Übereinstimmung von CPU-Höhensamples, gerenderten Dreiecken und Kollisionsraster, gemeinsame Randnormalen sowie Körperfreiraum zwischen allen Eckstarts, Ressourcen und Vents. Der Präsentationsvergleich erfasst die tatsächlichen Relief-/Zeichendaten, ohne neue Modelle wegzufiltern. Das ist keine Freigabe, unbeteiligte Referenzen nachzuziehen.
- `tests/fixtures/model-draw-v1.json` fixiert die um das Fitting bereinigte Worker-Assemblierung. `tests/models/model-isolation.check.cjs` prüft neun feste Gebäudeassemblierungen in allen Team-/Bau-/Vorschauvarianten; weitere Modelle haben eigene Geometrie-/Variantenverträge. Für zwei Choir-Gebäude normalisiert ausschließlich der Digest das separat geprüfte Fundament, während Körper und Baugerüst unverändert fixiert bleiben. Modelländerungen dürfen nur ihre eigenen Erwartungen betreffen, nicht pauschal die gesamte Fixture ersetzen.
- `tests/fixtures/effects-view-v1.json` fixiert reine Zeichenaufrufe, keine GPU-Pixel. Zeichnen darf weder Eingabedaten noch RNG verändern.

## Pflege

Bei einer beabsichtigten Änderung Vorher/Nachher isolieren, den fachlichen Grund im Commit bzw. offenen Issue erklären und neue Erwartungen unabhängig absichern. Mechanische Auslagerungen sollen vorhandene Referenzen unverändert treffen. Weitere feste Erwartungen stehen unmittelbar in Tests; Details und Umbauhistorie dort bzw. in Git suchen.

Szenarioaufbau darf den geprüften RNG nicht nebenbei verschieben. Insbesondere hält `tests/helpers/presentation-scenario.cjs` einen festen Effekt-RNG-Einstieg unabhängig vom Startaufgebot. Reservierte Samples und kontrollierte Testaufstellungen sind keine ausgelieferten Spielmodi und nicht automatisch entfernbares Legacy-Verhalten.

Zeichendigests sind kein Bildvergleich; wiederholbare Seeds keine allgemeine Crowd- oder Lockstep-Garantie. Passende Verhaltens-/Langzeittests ergänzen sie nach [Prüfrisiko](testing.md), menschliche Sichtung und echte Geräte bleiben eigenständige Nachweise.
