# Ashes of Meridian

Lokaler, touchorientierter Echtzeitstrategie-Roguelite-Prototyp mit drei Fraktionen und WebGL 2. Der Core Loop ist implementiert: **Basis aufbauen → Gefecht gewinnen → Expeditionsvorteil wählen → weiter vordringen → Nachhall in permanente Flottenupgrades investieren**. Bedienbarkeit auf echten Geräten und Langzeitbalancing sind noch zu validieren.

[Öffentliche Testversion](https://aom.markus-kottlaender.de/) für erste Playtests; Profile bleiben lokal im jeweiligen Browser.

## Starten

```bash
npm install
npm run build
```

Danach `index.html` direkt über `file://` in einem Browser mit WebGL 2 öffnen. Ein Server ist nicht erforderlich. HTML, Styles, Build-Ausgabe und lokale Laufzeitassets gemeinsam mitführen; es ist kein Ein-Datei-Paket. `npm run build:zip` erzeugt das direkt hochladbare HTML5-Paket `release/ashes-of-meridian-prototype.zip` für itch.io. Quellen und Ladevertrag: [Architektur](docs/architecture.md), Webhosting und Veröffentlichung: [Deployment](docs/deployment.md).

## Mothership-Höhenstufen

Mothership besitzt erhöhte Basisdecks, Rampen und ein tieferes Zentrum. Bodeneinheiten im Tiefland decken Hochplateaus nicht auf; Beobachter oben sehen innerhalb ihrer normalen Reichweite nach unten. Flugzeuge und Recon scans überbrücken Höhenstufen. Alien Planet und Desert bleiben vorerst unverändert. Offene menschliche Abnahme und eine mögliche spätere Übertragung auf weitere Karten stehen im [Höhenstufen-Issue](docs/issues/hoehenstufen/README.md).

Für einen isolierten Test startet `index.html?experiment=height` nach dem Build Mothership mit zwei eigenen Workern. Profil und Expeditionscheckpoint bleiben dabei flüchtig.

## Westmark

Westmark ergänzt die Kartenauswahl um ein alpines Tal mit Ressourcen, Flüssen und fahrzeugbreiten Steinbrücken. Die opaken Oberflächen verwenden prozedurale Materialrezepte, die Fichtenzweige weiterhin das Vorlagenbild; Materialien und Darstellung werden noch abgestimmt. `index.html?experiment=westmark` startet nach dem Build einen isolierten Probelauf mit zwei eigenen Workern, ohne normales Profil oder Expeditionscheckpoint zu verändern. [Offene Abnahme und Texturarbeiten](docs/issues/westmark-map.md).

## Frontier und feste Kartendesigns

Frontier erzeugt unterschiedlich große Landschaften mit **begehbaren Hügeln, Senken und Hängen**: Wege und ebene Bau-/Ressourcenterrassen verbinden welliges Land, Becken oder Höhenrücken. Prozedurale Laubbäume, Steine, Gräser und Blüten folgen diesem Terrain. Haven bleibt ein dauerhaft benanntes arides Design des unveränderten Frontier-v1-Rezepts mit festem Landschaftsseed und Abendlicht. Tageszeit und Materialvariante sind unabhängig von der Geometrie; bestehende Spezialkarten wie Aurelion behalten ihre feste Gestaltung. [Rezepte und Designpflege](docs/architecture.md#weltrezepte-und-feste-designs).

`index.html?experiment=frontier&seed=1409` beziehungsweise `index.html?experiment=haven&seed=1409` starten isolierte Probeläufe ohne dauerhafte Profiländerungen. Andere positive Seeds mit bis zu acht Stellen erzeugen auf Frontier andere Landschaften; Haven behält seine Landschaft. Zum Vergleichen: Frontier-Seed `1409` erzeugt 180 × 180 m welliges Land, `40517` ein 230 × 230 m großes Becken und `3` einen 280 × 280 m großen Höhenrücken. Das Pausenmenü zeigt Kartengröße, Seeds und gegebenenfalls Tageszeit. Menschliche Karten-/Nachtkontrastabnahme und Multiplayerfreigabe bleiben [offen](docs/issues/project-tomorrow.md#noch-nicht-erreicht--abnahme).

## Aurelion · Echo-Bergung

Aurelion ergänzt Expeditionen ab Stage 4 um **Echo salvage**: Worker bergen Fragmente aus einem zerborstenen fremdartigen Reaktorkern und bringen sie zum HQ. Die erste Partei mit 100 abgelieferten Fragmenten gewinnt. [Spielregeln](docs/gameplay.md#echo-bergung-auf-aurelion). Im Multiplayer bleibt die Karte ausgeschlossen.

`index.html?experiment=aurelion-playable` startet nach dem Build einen isolierten Probelauf auf Stage 4 mit drei FFA-Parteien und je zwei Workern. Profil und Expeditionscheckpoint bleiben flüchtig. [Offene Spiel- und Modellabnahme](docs/issues/aurelion-echo-bergung.md).

## Multiplayer-Prototyp

Unter **Multiplayer · prototype** können zwei Menschen eine Session erstellen bzw. per Code beitreten, mit freier Karten- und Fraktionswahl. Voreingestellt ist `wss://aoms.markus-kottlaender.de`; alternativ ist ein separat laufender [Multiplayerserver](server/README.md) nutzbar. Bewegungen werden geglättet, Kampf-Effekte und Audio sicht-/parteigefiltert übertragen; kurze Transportabbrüche werden innerhalb einer begrenzten Schonfrist automatisch wiederaufgenommen. Der letzte Raumcode wird im Browser vorausgefüllt. Nach Reload oder erneutem Öffnen innerhalb der Schonfrist bietet das Multiplayer-Menü an, die letzte Sitzung mit lokal gespeicherten, kurzlebigen Zugangsdaten fortzusetzen; bewusstes Verlassen, Sitzungsende oder Fristablauf entfernt diese wieder. Noch keine Expeditionen, Belohnungen oder Wiederherstellung nach Serverneustart. Das bisherige Einzelspiel bleibt offline nutzbar.

## Spielen

Über **Codex** im Startmenü sind alle drei Fraktionen mit Einheiten, Gebäuden, Portraits, animierter Modellansicht und der Geschichte auch vor ihrer spielerischen Freischaltung zugänglich. Der Codex verändert den Spielstand nicht.

Mit **New expedition** eine freigeschaltete Fraktion wählen. Die ersten drei Gefechte führen nacheinander gegen The Cinder Pact, The Manyroot und The Mourning Houses. Ab Stage 4 treten zwei, ab Stage 8 drei Gegner im **Free-for-all** an; deren Fraktionen werden wie Karte und Seed für jedes Gefecht neu bestimmt. Alle bekämpfen einander; das Missionsziel steht im Briefing. Jeder Gegner-Slot sammelt eigene Expeditionsvorteile; neue Gegner beginnen ohne Vorteile. Ohne Startworker zuerst unter **Infantry** einen Worker rekrutieren. Worker liefern Sternenschlacke, Raffinerien an Vents gewinnen Nachhall. Ein Sieg führt zur Vorteilswahl und zum nächsten Gefecht; eine Niederlage beendet die Expedition.

Fingerziehen/Pinch oder Mausziehen/Mausrad bewegt die Kamera; Tap bzw. Linksklick wählt, Rechtsklick erteilt Kontextbefehle. Basis- und Zoomknöpfe liegen unter der Minimap; der mittige Schwerter-Schalter aktiviert Attack-move. Das eingerahmte Gruppensymbol wählt eigene Kampfeinheiten im sichtbaren Bereich, das danebenliegende Gruppensymbol alle eigenen Kampfeinheiten außer Workern auf der gesamten Karte. Bau und Rekrutierung liegen rechts, Fähigkeiten mittig, Minimap links. **Cancel** beendet eine Zielauswahl.

Reserve, Upgrades, Expeditionstiefe und Einstellungen bleiben gespeichert. Eine laufende Expedition wird **zwischen Gefechten** automatisch gesichert; Reload oder Schließen verwirft nur das aktuelle Gefecht und setzt am letzten Übergang fort. Genaue Regeln und Bedienung: [Gameplay](docs/gameplay.md).

## Entwicklung

- [AGENTS.md](AGENTS.md): Arbeitsregeln für KI-Agenten.
- [Story und Welt](docs/story.md): deutsche interne Fassung des Einstiegs; die [englische Spielfassung](src/ui/codex.ts) ist im Startmenü über **Codex** lesbar.
- [Architektur](docs/architecture.md): technische Grenzen und nicht offensichtliche Verträge.
- [Grafik und Assets](docs/rendering.md): prozedurale Oberflächen, Modell-/Texturpflege und Darstellungsgrenzen. [Project Tomorrow](docs/issues/project-tomorrow.md) hält die noch offene Karten-, Material- und Geräteabnahme fest.
- [Prüfungen](docs/testing.md): gezielte Tests, Standardtestsuite, ausdrücklich beauftragte KI-/Simulationsläufe und Aussagegrenzen; [optionale lokale Performancediagnose](docs/testing.md#lokale-performancediagnose).
- [Feste Testreferenzen](docs/reference-tests.md): Umgang mit Fixtures.
- [Issues](docs/issues/): offene Aufgaben und Entscheidungen, darunter [Geräte-/Run-Validierung](docs/issues/playtest-validation.md).

### Pi-Subagents

[pi-subagents](https://github.com/nicobailon/pi-subagents) ist projektlokal eingerichtet. Der Hauptagent verteilt abgegrenzte Aufgaben auf eigene Worktrees, beantwortet Rückfragen und integriert die Ergebnisse. [Einrichtung und Arbeitsablauf](docs/subagents.md); verbindliche Grenzen in [AGENTS.md](AGENTS.md#parallele-arbeit-und-subagents).

### Manuelle Zuschauerpartie

`npm run simulate:visible` baut und öffnet eine persönliche KI-gegen-KI-Zuschauerpartie über `file://` im normalen Standardbrowser, ohne vorgegebene Fenstergröße. Das flüchtige Profil berührt keine normalen Browserdaten. Jeder Run startet mit 1× und wechselt nach zehn Echtzeitsekunden auf 2×; Tab/Fenster selbst schließen. **Kein Test- oder Agentenabnahmebefehl, nie automatisch ausführen.**
