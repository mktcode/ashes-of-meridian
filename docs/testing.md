# Prüfungen

Prüfaufwand folgt dem Änderungsrisiko. Nicht jede Codeänderung braucht die Gesamtsuite, nicht jede Grafikänderung einen Browserlauf. Vorab klären: Welches Verhalten kann betroffen sein, und welche Prüfung liefert dafür einen belastbaren Nachweis?

## Prüfwahl

| Änderung / Risiko | Übliche Prüfung |
| --- | --- |
| Dokumentation | Diff, betroffene Links und Angaben; keine Spieltests |
| Minimale Text-/Rahmen-/Abstandsänderung | Diff und passende statische Prüfung |
| Mechanische, verhaltensneutrale Code-Kleinständerung | Build und Diff; nur ohne Logik-/RNG-/Schnittstelleneingriff |
| Lokale Verhaltensänderung | Build und gezielte betroffene Tests; Regression für den Fehler bzw. neuen Vertrag |
| Gemeinsame Simulation, RNG, Ladeverträge, breite oder unklar eingrenzbare Auswirkungen | Gesamtsuite mit `npm test` |
| Langzeitverhalten, KI, Navigation oder Ökonomie | Passende längere Simulationsszenarien; bei übergreifenden Änderungen Gesamtsuite |
| Rendering, Eingabe oder Auslieferung | Technische Prüfung der konkreten Änderung; Browsercheck, wenn Node/statische Prüfung die Fragestellung nicht abdecken |

Bei Unsicherheit die mögliche Auswirkung prüfen und den Umfang entsprechend erweitern, nicht automatisch bei jeder Kleinigkeit alle Simulationen starten. Bestehende Langzeittests nicht wegen ihrer Laufzeit entfernen oder ihre Erwartungen zum Grünmachen abschwächen.

## Befehle und Auswahl

Tests laufen gegen die erzeugten klassischen Skripte, deshalb vor einem gezielten Lauf neu bauen:

```bash
npm run build
node --max-old-space-size=128 --test --test-concurrency=1 tests/ashes-of-meridian-persistence.check.cjs
```

Einzelne Szenarien lassen sich über ihren Testnamen wählen, zum Beispiel nach dem Build:

```bash
node --max-old-space-size=128 --test --test-concurrency=1 --test-name-pattern='profile defaults' tests/ashes-of-meridian-persistence.check.cjs
```

Die passende Datei bzw. den Namen in `tests/` suchen (`rg 'test\(' tests`); keine parallele Markdown-Abdeckungsliste pflegen. Bei Namensfiltern die Ausgabe prüfen: übersprungene Tests sind keine bestandenen Tests. Filter umgehen außerdem nicht unbedingt den Aufbau auf Dateiebene. Für Änderungen an gemeinsamen Helfern auch deren Nutzer berücksichtigen.

```bash
npm test
```

baut neu und führt die Gesamtsuite einschließlich längerer Simulationen aus. Die genaue Auswahl und Runneroptionen stehen in `package.json`. **`npm test -- …` ist kein Ersatz für einen gezielten Dateilauf** mit dem obigen Node-Befehl.

CPU-Simulationstests laden keinen Renderer; Grafikgeometrie und Uploads separat prüfen. Tests für einzelne Einheitenregeln isolieren den strategischen Controller, KI-Abnahmen verwenden echte Aktionen/Produktion. Neue Abdeckung fachlich klein halten, keine redundanten Karten-/Fraktions-/Upgrade-Kreuzprodukte ohne zusätzlichen Erkenntniswert. Umgang mit Sollwerten: [Feste Referenzen](reference-tests.md).

## Browser und menschliche Abnahme

Ein gezielter technischer Browsercheck verwendet den aktuellen Build, ein isoliertes Profil und direkt `file://`, ohne abgeschwächte Sicherheitsflags. Nur betroffene Abläufe prüfen, etwa:

- Shader-/Assetänderung: Laden, Kompilieren, WebGL-Fehler, betroffene Qualität.
- Viewport/Eingabe: Projektion und Picking, Overlayoffset, Resize und betroffene Touch-Aktion.
- Expedition/Profil: betroffener Start-, Pause-, Ergebnis-, Vorteilswahl-, Abbruch- oder Reload-Pfad. Reload darf nur den gesicherten Übergang, nie die laufende Welt wiederherstellen.
- Webcontainer: Imagebau, Healthcheck, MIME-Typen, fehlende Assets/404 und bei Bedarf HTTP-Start gemäß [Deployment](deployment.md).

**Technisch geprüft und visuell bestätigt sind getrennte Aussagen.** Visuelle und akustische Abnahme erfolgt durch den Menschen; bei Bedarf konkret benennen, was noch anzusehen oder anzuhören ist. Automatisierte Screenshots können eine gezielte Diagnose unterstützen, sind aber keine Pflichtserie und kein menschliches Qualitätsurteil.

Node führt kein GLSL aus. Headless-/Software-WebGL ist kein Echtgeräte-Performancenachweis; emuliertes Touch kein Nachweis realer Gesten unter Last. Automatische KI-Partien beweisen kein menschliches Balancing. Offene Abnahme: [Geräte und vollständige Runs](issues/playtest-validation.md).

Die [manuelle Zuschauerpartie](../README.md#entwicklung) ist kein Testbefehl und wird von Agenten nie automatisch geöffnet. Im Abschluss tatsächlich ausgeführte Prüfungen und relevante ausgelassene Bereiche nennen. Nur wenn daraus offene Arbeit entsteht, den Befund samt Kontext im passenden Issue festhalten; kein separates Prüfprotokoll oder Fortschreiben von Testzahlen in Referenzen.
