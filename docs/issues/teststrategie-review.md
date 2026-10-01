# Teststrategie · Review und offene Entscheidungen

Lesendes Review des aktuellen Testaufbaus, der Runnerauswahl und der Prüf-/Architekturreferenzen. Keine Tests, Builds, Browserläufe oder Laufzeitmessungen ausgeführt; Aussagen zu Kosten sind Strukturindikatoren, keine gemessene Rangliste. Kein Auftrag zur Umsetzung der folgenden Vorschläge. Ein vollständiges Quellcodeaudit bleibt ein eigener Folgeschritt.

## Konkrete Befunde

### Standardauswahl lässt Modellkachel-Verträge aus

`tests/ashes-of-meridian-model-thumbnails.check.cjs` wird von keinem npm-Testskript ausgewählt. Anders als die ausdrücklich getrennten KI-/Simulationsdateien ist dieser Ausschluss nicht dokumentiert. Die Datei prüft unter anderem Cache-Wiederverwendung, Speicherbegrenzung, Zustandsisolation und 2×-MSAA/Fallback. Verwandte UI-/Rendererchecks ersetzen diese gezielten Verträge nicht. Relevant für die [offene Modellkachel-Abnahme](modell-kacheln.md).

Vorschlag: in die technische Standardauswahl aufnehmen; die Auswahlwartung so absichern, dass neue Testdateien entweder enthalten oder bewusst einem gesonderten Block zugeordnet sind. Nicht alle Dateien ungeprüft per Glob aktivieren: Die Freigabegrenze der beiden Langlaufblöcke muss erhalten bleiben.

### Tests widersprechen der UI-Prüfstrategie

[Prüfungen](../testing.md#schwerpunkt-im-prototyp) schließen dauerhafte Wortlaut-/Markup-Sollbilder und reine Wiederkehrverbote früher entfernter Texte aus. Dennoch prüft `ashes-of-meridian-codex.check.cjs` konkrete Geschichtentexte, Kapitelanzahl, Blockquote-Markup und das Fehlen alter Begriffe/Hinweistexte. `ashes-of-meridian-controls.check.cjs` fixiert etwa ab Zeile 75 Überschriften, Icons, exakte Kosten-/Effekttexte und Markup-Verkettungen; weitere Beispiele stehen im Gegnerbriefing und Ergebnistexttest.

Vorschlag: rein redaktionelle und Layoutfestlegungen entfernen, aktuelle funktionale Verträge erhalten: vollständige Content-/Modellzuordnung, korrektes Escaping, keine Mutation/RNG-Nutzung, zulässige Akteure/Aktionen, Auszahlungen und Profilgrenzen. Kosten-/Upgrade-Fachregeln unabhängig vom HTML prüfen. Das spart vor allem Änderungsaufwand, nicht nachgewiesen nennenswerte Laufzeit.

### Standardlauf ist bereits eine breite technische Integration

`ashes-of-meridian-terrain.check.cjs` enthält 20 Desert-Zugänglichkeitsseeds, sechs ausführliche Alien-Setups und 40 zusätzliche Alien-Seeds. `ashes-of-meridian-world-variations.check.cjs` prüft alle Kartenfamilien mit Vertretern jeder Variante, vollständigen Fahrzeugrouten und teils vertexweisen Surface-/Meshvergleichen. Weitere Terrain-/Surfacechecks stehen in World-Designs, Highlands, Elevation und kartenbezogenen Dateien.

Diese Prüfungen schützen relevante prozedurale Risiken; unterschiedliche Varianten sind nicht automatisch redundant. Sie sind aber Kandidaten für eine getrennte ausführliche Terrainprüfung statt für jede lokale Änderung. Zuerst pro Datei/Test messen und nach Vertrag vergleichen. Repräsentative Varianten und bekannte Fehlerseeds in einer kürzeren Auswahl erhalten; Seed-Sweeps nicht ersatzlos löschen oder Erwartungen abschwächen. Die aktuelle Standardtestsuite bleibt bis zu einer ausdrücklich entschiedenen Umstellung unverändert maßgeblich.

### Schnelle und lange Prüfungen sind in optionalen Dateien gemischt

`ashes-of-meridian-simulation.check.cjs` enthält neben Schritt-/Crowdszenarien auch eng begrenzte Validatoren und Zustandsregeln, etwa unbekannte Strukturen, ungültige Rekrutierung, Verkaufsschutz und Fähigkeitsablehnung ohne Nebenwirkungen. `ashes-of-meridian-ai.check.cjs` mischt Controller-/Beobachtungsregeln mit kompletten Partien: neun Fraktionspaarungen mit bis zu 24.000 Schritten, drei Alien-Partien mit bis zu 36.000 Schritten und weitere Tiefen-/Vorteilspartien.

`ashes-of-meridian-ai-planning.check.cjs` zeigt bereits den sinnvollen Gegenpol: kleine Planungsfälle ohne autonome Partien. Vorschlag: ergänzende schnelle Verträge nur nach Abdeckungsvergleich aus den optionalen Dateien herauslösen; Langzeitszenarien behalten. Die aktuelle ausdrückliche Freigabepflicht gilt bis dahin auch für kurze gefilterte Fälle dieser Dateien.

### Historische Modellabsicherung erzeugt vermeidbare breite Arbeit

`tests/models/model-isolation.check.cjs` berechnet über `modelDrawDigests` alle Modelle in 18 Varianten. Anschließend werden sämtliche Unit-Digests und viele Gebäudedigests nur auf Abweichung von alten Sollwerten geprüft und aus dem eigentlichen Vergleich gelöscht. Neun Modelle bleiben exakt verglichen. Unabhängige aktuelle Modellprüfungen existieren in `tests/models/`.

Vorschlag: die weiterhin maßgeblichen neun Referenzen gezielt berechnen; für die ausgefilterten Modelle prüfen, ob der alte Abweichungsnachweis noch einen aktuellen fachlichen Grund hat. Nicht pauschal Fixtures entfernen oder neu erzeugen. Aktuelle Geometrie-, Budget-, Varianten- und RNG-Isolationsverträge erhalten. Spezialprüfungen in `ashes-of-meridian-presentation.check.cjs` für HQ/Worker/Turret mit den neuen Modellverträgen vergleichen; die Überlappung ist kein Beweis vollständiger Redundanz, etwa outward-winding und alte Worker-Hülle haben eigene Schutzwirkung.

### Shader-Strings sind nur begrenzte Qualitätsnachweise

`ashes-of-meridian-renderer.check.cjs` prüft an mehreren Stellen exakte GLSL-Ausdrücke mittels `includes`. Das schützt einzelne Verdrahtungen, bindet aber auch semantisch neutrale Shaderumbauten und bestätigt weder GLSL-Kompilierung noch GPU-Ausgabe.

Vorschlag: essentielle Interface-/Ressourcenverträge behalten, reine Formel-Schreibweisen bei gezielter Shaderpflege hinterfragen. Kein automatischer Ersatz durch Browser-/Screenshotserien; technische Shaderprüfung bei konkreter Änderung, menschliche Darstellungsabnahme separat.

## Prozess und Struktur

- Gut erhalten: CPU-/Renderergrenze, echte Akteurs-/Sichtprüfung, RNG-Isolation, unabhängige VM-Kontexte, gezielte Datei-/Namensauswahl und ausdrückliche Trennung menschlicher Abnahme von technischen Nachweisen.
- Der Loader cached Quellen/Bytecode bereits pro Testprozess, nicht Spielzustände. Kein weiterer gemeinsamer mutable VM-/Weltcache als Laufzeitabkürzung.
- Große gemischte Testdateien erschweren Dateiauswahl und Namensfilter: Controls knapp 2.000 Zeilen, Simulation über 1.600, Presentation über 1.000. Bei Testumbauten nach funktionalen Verträgen teilen, ohne beiläufige Produktionscode-Neuarchitektur.
- `npm test` verwendet serielle Testprozesse und 128 MiB Heap. Mehr Parallelität kann Laufzeit reduzieren, aber Spitzen-RAM erhöhen; ohne Messung weder Heaplimit noch Concurrency ändern.
- Der gesonderte Servertestlauf ist sinnvoll und dokumentiert; ein grünes Root-`npm test` prüft nicht die echten WebSocket-Sitzungen. Für gemeinsame Netzwerkverträge gezielt beide Bereiche auswählen.
- Dokumentation besitzt bereits eine gute zentrale Prüfstrategie. Den Widerspruch zwischen Strategie und tatsächlichen Tests beheben statt noch eine parallele Abdeckungsliste einzuführen. Die Architektur begründet klassische Skripte mit `file://`; kein Anlass für einen Import-/Bundlerumbau allein zur Testbeschleunigung.

## Empfohlene Reihenfolge

1. Modellkachel-Auswahl und Auswahlwartung sichern; UI-Text-/Markupfestlegungen fachlich bereinigen.
2. Auf gesonderten Auftrag Standardlauf messen: Build getrennt, Dateizeiten, teuerste Szenarien und bei Concurrencyfragen Speicher erfassen. KI-/Simulationsmessungen benötigen zusätzlich ihre ausdrückliche aktuelle Freigabe. Scratch ausschließlich im eigenen `.tmp/`.
3. Mit diesen Daten kurze Vertragsprüfungen, Standardintegration und ausführliche Terrain-/Modellprüfungen abgrenzen. Langzeit-KI, Crowd-/Replay- und Geräteabnahme bleiben eigenständige Nachweise. Keine neue pauschale Pflichtsuite für jede lokale Änderung.
4. Erst danach gezielt Testdateien/Helfer umbauen, Referenzen und aktuelle Fachverträge erhalten. Dokumentation und Runnerauswahl gemeinsam aktualisieren.
