# Prüfungen

Prüfaufwand folgt dem Änderungsrisiko. Nicht jede Codeänderung braucht die Standardtestsuite, nicht jede Grafikänderung einen Browserlauf. Vorab klären: Welches Verhalten kann betroffen sein, und welche Prüfung liefert dafür einen belastbaren Nachweis?

## Schwerpunkt im Prototyp

Die automatisierte Suite konzentriert sich auf Simulation und unit-testbare Logik: Ökonomie, KI, Navigation, RNG, Persistenz und technische Ressourcen-/Ladeverträge. Logik hinter UI-Aktionen bleibt prüfbar, etwa einmalige Auszahlungen, Upgradegrenzen, Befehlsauswahl und Pause-Guards; dafür nicht Texte oder komplettes Markup vergleichen.

UI-Wortlaut, Layout, Farben, Menüaufteilung und vollständige Navigationsabläufe werden manuell beurteilt, nicht durch dauerhafte HTML-/CSS-Sollbilder festgeschrieben. Ebenso keine Tests oder Stub-Verbotslisten behalten, deren einziger Zweck der Nachweis einer früheren Entfernung ist. Eine beauftragte Entfernung braucht Diff und passende einmalige Prüfung, keinen dauerhaften Test gegen die Wiederkehr alter Namen, Bedienelemente oder Implementierungen. Gemischte Tests auf ihre weiterhin relevante Logik reduzieren. Negative Prüfungen mit aktuellem fachlichem Grund bleiben sinnvoll: etwa keine doppelte Auszahlung, keine verborgenen Feindinformationen und keine RNG-Mutation beim Zeichnen.

End-to-End-Abnahme erfolgt laufend durch den Nutzer; vorhandene Simulationsszenarien ergänzen sie. Automatische Browser-/E2E-Läufe sind kein Pflichtteil der Suite und werden von Agenten nicht routinemäßig ergänzt oder gestartet.

## Prüfwahl

| Änderung / Risiko | Übliche Prüfung |
| --- | --- |
| Dokumentation | Diff, betroffene Links und Angaben; keine Spieltests |
| Minimale Text-/Rahmen-/Abstandsänderung | Diff; bei Quellcodeänderungen Build, keine Text-/Layouttests |
| Mechanische, verhaltensneutrale Code-Kleinständerung | Build und Diff; nur ohne Logik-/RNG-/Schnittstelleneingriff |
| Lokale Logikänderung | Build und gezielte betroffene Tests; Regression für den Fehler bzw. weiterhin relevanten Vertrag |
| Gemeinsame Simulation, RNG, Ladeverträge, breite oder unklar eingrenzbare Auswirkungen | Standardtestsuite mit `npm test`; zusätzlichen KI-/Simulationsbedarf zur Freigabe vorschlagen |
| Langzeitverhalten, KI, Navigation oder Ökonomie | Passende KI-/Simulationsfälle nur auf ausdrücklichen Nutzerauftrag |
| Rendering, Eingabe oder Auslieferung | Betroffene technische Logik prüfen; Darstellung und E2E manuell, Browserdiagnose nur bei konkretem Bedarf |

Bei Unsicherheit die mögliche Auswirkung prüfen; für KI-/Simulations-Testblöcke nötige Freigabe abwarten statt sie automatisch zu starten. Bestehende Langzeittests nicht wegen ihrer Laufzeit entfernen oder ihre Erwartungen zum Grünmachen abschwächen.

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

baut neu und führt die Standardtestsuite **ohne die beiden umfangreichen KI- und Simulations-Testdateien** aus. Terrain-, Präsentations- und übrige technische Tests bleiben enthalten; auch der Standardlauf ist daher nicht ausschließlich eine schnelle Unit-Test-Suite. Die genaue Auswahl und Runneroptionen stehen in `package.json`. **`npm test -- …` ist kein Ersatz für einen gezielten Dateilauf** mit dem obigen Node-Befehl.

Die beiden umfangreichen Blöcke sind getrennt ausführbar und bauen jeweils vorher neu:

```bash
npm run test:ai
npm run test:simulation
```

**Nur auf ausdrücklichen aktuellen Nutzerauftrag**, gemäß [AGENTS.md](../AGENTS.md#risikobasiert-prüfen); nicht automatisch bei Implementierung, Integration oder Abschlussprüfung. Diese Freigabepflicht gilt ebenso für per Dateipfad oder Namensfilter ausgewählte Fälle dieser Blöcke. Nach Freigabe ist auch hier der direkte Node-Befehl mit `--test-name-pattern` vor dem Dateipfad möglich. Eine Freigabe für einen Einzeltest erlaubt nicht automatisch die ganze Datei oder den anderen Block. Insbesondere gehören Startpositions-/Replayprüfungen zum Simulationsblock und die team-/fraktionsübergreifende Fähigkeitsprüfung zum KI-Block.

Im Abschluss Standardlauf, gezielte Tests und ausdrücklich beauftragte Langläufe getrennt benennen. Ein grünes `npm test` bedeutet nicht, dass auch die beiden optionalen Blöcke geprüft wurden.

Der VM-Harness liest den gebauten Skriptbestand je Testprozess einmal und kompiliert angeforderte Skripte wiederverwendbar. Jeder `loadScripts`-Aufruf erzeugt trotzdem einen frischen VM-Kontext: keine gemeinsamen Contentobjekte, Prototypen oder Spielzustände. Explizite `readScripts`-Aufrufe lesen weiterhin frisch; eigene Loader-Fixtures können Quellen und Dateinamen austauschen. Nach einem neuen Build einen neuen Testprozess starten, keinen bestehenden Prozess als Watch-Runner verwenden.

CPU-Simulationstests laden keinen Renderer; Grafikgeometrie und Uploads separat prüfen. Tests für einzelne Einheitenregeln isolieren den strategischen Controller, KI-Abnahmen verwenden echte Aktionen/Produktion. Neue Abdeckung fachlich klein halten, keine redundanten Karten-/Fraktions-/Upgrade-Kreuzprodukte ohne zusätzlichen Erkenntniswert. Umgang mit Sollwerten: [Feste Referenzen](reference-tests.md).

## Multiplayer-Prototyp

Die Standardtests enthalten synthetische Sichtprojektion, Ressourcen-Gedächtnis und die Sperre lokaler Ausführung im Netzwerkmodus. Darstellungsprüfungen decken Interpolation ohne Zustandsmutation, Sichtverlust, Ereignisfilter/-grenzen, Audiofreigabe und ausgeschlossene Persistenzereignisse ab; ein kurzer direkter Kampfschritt vergleicht Zustand und beide RNG-Ströme mit/ohne Präsentations-Observer. Nach `npm run build --prefix server` prüft `npm test --prefix server` zusätzlich kurze echte WebSocket-Sitzungen mit menschlichen Controllern auf allen Karten, Akteursbindung, Annahme/Ausführung und Abbruch. Das sind gezielte Netzwerkprüfungen, keine autonomen KI-Partien oder Ersatz für die gesonderten Simulations-Langläufe. Serverabhängigkeiten vorher separat installieren; Details unter [Server](../server/README.md).

### Kapazitätsbefund

Ein einmaliger lokaler CPU-Benchmark verwendete das echte Serverbundle, 20 Ticks/s sowie 10 Frames/s für je zwei Parteien einschließlich Sichtprojektion und JSON-Serialisierung. Referenzrechner war ein Ryzen 7 5700G; Prozentwerte bezeichnen einen Kern, nicht die Gesamtmaschine. Die Mothership-Leerlauffixture begann mit 50 Karten-/Startentitäten; die Laststufen ergänzten:

| Last | Ergänzung | gemessene Kernlast je Raum | ausgehende Daten je Raum |
| --- | --- | --- | --- |
| Leerlauf | keine | ca. 0,6 % | ca. 0,34 MiB/s |
| Mittel | 80 Einheiten, 18 Gebäude | ca. 3,8 % | ca. 0,8 MiB/s |
| Hoch | 200 Einheiten, 38 Gebäude | je nach Karte ca. 13–19 % | ca. 1,4 MiB/s |

Unter der hohen Last lagen zwei Räume lokal bei p99 ca. 29 ms und maximal 38 ms pro 50-ms-Serverintervall. Vier Räume überschritten mit p99 ca. 63 ms und maximal 80 ms das Echtzeitbudget. RAM war mit grob wenigen MiB Heap je Raum nicht begrenzend; CPU-Spitzen und unkomprimierte Vollzustände sind die relevanten Grenzen. Kampf reduziert die Entitätszahl im Verlauf, vollständige Sicht maximiert dagegen die Projektion; die Werte sind Kapazitätsindikatoren, kein Produktions-SLA.

Die Ziel-VM mit zwei virtuellen EPYC-Rome-Kernen wurde dabei nicht unter künstliche Last gesetzt. Da ein Node-Prozess die Räume seriell abarbeitet, bleibt die absolute Grenze von zwei Räumen bewusst konservativ. Vor jeder Erhöhung einen reproduzierbaren Test direkt auf der Zielklasse ausführen und mindestens Tick-p95/p99, verfehlte 50-ms-Intervalle, CPU, RSS und ausgehende Bytes erfassen. Solche Lastläufe sind Simulations-/Performanceprüfungen und benötigen wie andere umfangreiche Läufe einen ausdrücklichen aktuellen Auftrag.

## Lokale Performancediagnose

Nach dem Build `index.html?diagnostics=1` im normalen Browser öffnen, auch direkt über `file://`. Bei bereits vorhandenen URL-Parametern `&diagnostics=1` anhängen. Es werden weder Server noch Browser-Add-on oder besondere Sicherheitsflags benötigt. Ohne diesen Parameter gibt es keine Diagnose-Aufzeichnung, Bedienelemente oder Timerabfragen.

- Normal spielen; rechts oben stehen **Export diagnostic JSON** und **Stop recording**. Export lädt einen lokalen JSON-Bericht herunter und lässt die Aufzeichnung weiterlaufen. Stop beendet nur die Messung, nicht das Spiel. Für eine neue Aufzeichnung neu laden; vor einem Reload bei Bedarf exportieren.
- Die Aufzeichnung ist begrenzt: letzte 6000 rAF-Callbacks und letzte 120 Ressourcen-/Kontextproben, höchstens eine Probe pro Sekunde nach einem gezeichneten Frame. Die abgedeckte Zeit hängt von der Callbackrate ab. Es gibt keine automatische Speicherung, Übertragung oder Konsolenprotokollierung. Ein schließbarer Tab oder Browserabsturz kann den Bericht verlieren.
- Bei behandeltem WebGL-Kontextverlust oder Renderfehler endet die Messung. Der bisherige Bericht bleibt über denselben Exportknopf erreichbar, solange die Seite noch bedienbar ist. Das ist keine automatische Wiederherstellung des Gefechts.
- Der Bericht enthält Browserkennung, DPR, Kartenname/Seed, Qualität, Zielmaße, Spieltempo, Einzel-/Multiplayerstatus und aggregierte Zähler. Keine URLs, Spieler-/Raumnamen, Zugangstokens oder vollständigen Spiel-/Netzwerkzustände. Auf Wunsch ist derselbe Bericht über `window.Meridian.diagnostics.report()` in den Entwicklertools erreichbar.

CPU-Phasen messen verstrichene Zeit für Simulation einschließlich Effekttick, Netzwerkpräsentation, UI, Audio, Szenenaufbau, GL-Einreichung und Overlay. Die gesamte Callbackmessung enthält auch Diagnoseaufwand; es handelt sich nicht um CPU-Auslastungsprozente. Callbackintervalle und Intervalle tatsächlich gezeichneter Bilder sind getrennt, damit das 60-FPS-Limit nicht als Engpass fehlinterpretiert wird. Hintergrundlücken bleiben enthalten. Perzentile beziehen sich auf den gespeicherten Ausschnitt, nicht automatisch auf ein ganzes Gefecht; Menüs, Qualitätswechsel und Pausen können darin gemischt sein.

GPU-Zeiten werden nur bei verfügbarer `EXT_disjoint_timer_query_webgl2` asynchron und stichprobenartig gemessen. Modellkacheln (`thumbnails`), Schatten, Szene einschließlich MSAA-Auflösung, Bloom und Postprocessing sind getrennt. Nicht ausgeführte oder noch nicht verfügbare Messungen fehlen, statt als null Millisekunden einzufließen. Disjoint-Ergebnisse werden verworfen, offene Queries sind begrenzt und werden beim Stop freigegeben; kein `gl.finish()` oder blockierendes Readback. Nicht unterstützte/fehlgeschlagene Timer verhindern die CPU-Diagnose nicht.

Zeichen-/Dreieckszähler umfassen eingereichte Arbeit einschließlich Vollbilddreiecken und wiederholten Schatteninstanzen, nicht sichtbare Pixel. Instanz-Uploads werden gezählt; Geometrie- und Renderzielbytes sind Schätzungen, CPU-Instanzkapazität ist separat. Materialtexturen werden bisher nur gezählt, ihre Bytes nicht geschätzt. Tatsächlicher Treiberspeicher, Browser-Compositor und Gerätetemperatur werden nicht gemessen. Ergebnisse der Workstation sind deshalb keine Pixel-7-Thermik- oder Stabilitätsbestätigung.

Für Vergleiche denselben Abschnitt mit gleichen Einstellungen verwenden und getrennte Berichte erzeugen. Die Diagnose selbst verursacht Aufwand; keine Einsparungen oder Engpassursachen aus einer einzigen Aufnahme ableiten. Automatisierte Last-/Simulationsläufe sind damit nicht freigegeben. Offene Geräteabnahme und nächste Messfragen: [Mobile Performance](issues/mobile-performance.md#messplan-und-abnahme).

## Browser und menschliche Abnahme

Ein bei konkretem Diagnosebedarf beauftragter technischer Browsercheck verwendet den aktuellen Build, ein isoliertes Profil und direkt `file://`, ohne abgeschwächte Sicherheitsflags. Nur betroffene Abläufe prüfen, etwa:

- Shader-/Assetänderung: Laden, Kompilieren, WebGL-Fehler, betroffene Qualität.
- Viewport/Eingabe: Projektion und Picking, Overlayoffset, Resize und betroffene Touch-Aktion.
- Expedition/Profil: betroffener Start-, Pause-, Ergebnis-, Vorteilswahl-, Abbruch- oder Reload-Pfad. Reload darf nur den gesicherten Übergang, nie die laufende Welt wiederherstellen.
- Webcontainer: Imagebau, Healthcheck, MIME-Typen, fehlende Assets/404 und bei Bedarf HTTP-Start gemäß [Deployment](deployment.md).

**Technisch geprüft und visuell bestätigt sind getrennte Aussagen.** Visuelle und akustische Abnahme erfolgt durch den Menschen; bei Bedarf konkret benennen, was noch anzusehen oder anzuhören ist. Automatisierte Screenshots können eine gezielte Diagnose unterstützen, sind aber keine Pflichtserie und kein menschliches Qualitätsurteil.

Node führt kein GLSL aus. Headless-/Software-WebGL ist kein Echtgeräte-Performancenachweis; emuliertes Touch kein Nachweis realer Gesten unter Last. Automatische KI-Partien beweisen kein menschliches Balancing. Offene Abnahme: [Geräte und vollständige Runs](issues/playtest-validation.md).

Die [manuelle Zuschauerpartie](../README.md#entwicklung) ist kein Testbefehl und wird von Agenten nie automatisch geöffnet. Im Abschluss tatsächlich ausgeführte Prüfungen und relevante ausgelassene Bereiche nennen. Nur wenn daraus offene Arbeit entsteht, den Befund samt Kontext im passenden Issue festhalten; kein separates Prüfprotokoll oder Fortschreiben von Testzahlen in Referenzen.
