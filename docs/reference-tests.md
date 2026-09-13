# Feste Testreferenzen

Fixtures schützen vor unbeabsichtigten Änderungen, nicht vor bewusst beauftragter Weiterentwicklung. **Sollwerte niemals allein deshalb neu erzeugen, weil ein Test fehlschlägt.** Erst Ursache und beabsichtigten Änderungsumfang klären; unabhängige Erwartungen und unbeteiligte Referenzen erhalten.

## Relevante Besonderheiten

- `tests/fixtures/presentation-v1.json` schützt Terrain-/Platzierungs-/Navigationsdaten von Desert sowie Effektpayloads, Lebensdauer und RNG-Folgesamples. `originalLayouts` sichert das aus kleinen Felsblockern rekonstruierte Raster separat. Der Digest-Schlüssel `massifs` bezeichnet heutige `renderData.features`; er ist eine Serializerkonvention, kein Laufzeit-Alias. Ursprung: `97bfda6`, gezielte spätere Anpassungen sind in Git nachvollziehbar.
- Alien Planet und Mothership werden nach bewusster Neugestaltung nicht gegen alte Desert-artige Digests geprüft, sondern über unabhängige Zugänglichkeit, Wiederholbarkeit, RNG-Isolation, Geometriebudgets und vollständige KI-Runs. Das ist keine Freigabe, andere Kartenreferenzen nachzuziehen.
- `tests/fixtures/model-draw-v1.json` enthält Zeichenfolgen aus `d4689d2`. Der aktuelle Isolationsvergleich in `tests/models/model-isolation.check.cjs` ergänzt freigegebene Gebäudereferenzen aus `b7b9efc`; beauftragt verfeinerte Fraktion-0-Einheiten haben eigene Geometrie-/Variantenprüfungen. Beim Worker bleibt zusätzlich die um das Fitting bereinigte Altassemblierung fixiert. Modelländerungen dürfen nur ihre eigenen Erwartungen betreffen, nicht pauschal die gesamte Fixture ersetzen.
- `tests/fixtures/effects-view-v1.json` fixiert reine Zeichenaufrufe aus `b9f0026`, keine GPU-Pixel. Zeichnen darf weder Eingabedaten noch RNG verändern.

## Pflege

Bei einer beabsichtigten Änderung Vorher/Nachher isolieren, den fachlichen Grund im Commit bzw. offenen Issue erklären und neue Erwartungen unabhängig absichern. Mechanische Auslagerungen sollen vorhandene Referenzen unverändert treffen. Weitere feste Erwartungen stehen unmittelbar in Tests; Details und Umbauhistorie dort bzw. in Git suchen.

Szenarioaufbau darf den geprüften RNG nicht nebenbei verschieben. Insbesondere hält `tests/helpers/presentation-scenario.cjs` einen festen Effekt-RNG-Einstieg unabhängig vom Startaufgebot. Reservierte Samples und kontrollierte Testaufstellungen sind keine ausgelieferten Spielmodi und nicht automatisch entfernbares Legacy-Verhalten.

Zeichendigests sind kein Bildvergleich; wiederholbare Seeds keine allgemeine Crowd- oder Lockstep-Garantie. Passende Verhaltens-/Langzeittests ergänzen sie nach [Prüfrisiko](testing.md), menschliche Sichtung und echte Geräte bleiben eigenständige Nachweise.
