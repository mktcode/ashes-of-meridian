# Projektprioritäten und offene Folgeentscheidungen

Planungsgrundlage, **keine Implementierungsfreigabe**. Ziel ist Konsolidierung: verlässliche Bedienung, taktische Lesbarkeit, gemessene Performance und interessante Entscheidungen über vollständige Runs. Technische Vielfalt ist weiter als die menschliche Spiel-/Geräteabnahme; eine neue Engine oder pauschaler Assetersatz ist daraus nicht begründet.

## Nächste Prioritäten

1. **Performance eingrenzen:** vorhandene [Nutzeraufnahme](mobile-performance.md#erste-lokale-nutzeraufnahme) zeigt Simulationsspitzen, aber keinen konkreten Unterpfad. Diagnose bei Bedarf um Buildkennung, Schritte pro Callback, Bewegung/Wegsuche, KI, Sicht, Kampf/Wirtschaft und Effekttick ergänzen. Ohne Diagnoseparameter keine zusätzliche Frame-Messarbeit. Erst nach Profilbeleg optimieren.
2. **Blockierte Worker/Produktion nachvollziehbar machen:** Auftrag, Warten auf Ausgang und wiederholte Wegprobleme sichtbar unterscheiden. Temporäre Blockade nicht als endgültigen Fehler behandeln; keine Teleports, Erstattungen oder automatischen Auftragsabbrüche. [Reproduktion und Grenzen](worker-bauwegfindung/issue.md).
3. **Taktische Darstellung abnehmen:** [Kontursilhouetten, Bauflächen, Wetter und Weltfamilien](project-tomorrow.md#noch-nicht-erreicht--abnahme) bei normalem Gefechtszoom und auf Zielgeräten prüfen. Erkennbarkeit Worker/Kampftruppe, Medic/Commander, Panzer/Artillerie und Parteien derselben Fraktion ist wichtiger als neue Nahaufnahmendetails. [Modelle](choir-court-einheiten.md), [Modellkacheln](modell-kacheln.md).
4. **Vollständige Runs spielen:** Einstieg ohne permanente Upgrades, Vorteilsentscheidungen, Übergänge zu Stage 4/8, frühe Rush-Kombinationen und tiefe Ressourcenstapel. [Run-Validierung](playtest-validation.md), [Progression](expeditions-schwierigkeit-und-upgrades.md).

## Danach entscheiden

- **Zugänglicher profilfreier Test-/Skirmish-Start:** Karte, Seed und Fraktionen wählen. Experiment-URLs sind technische Hilfen, keine vollständige Spieleroberfläche. Zuerst [Regeln](new-battle-screen.md) entscheiden; Seedfavoriten können daran anschließen.
- **Ein strategisch variableres Kartenrezept oder Holdout-Pilot:** mehr Pflanzenfamilien erzeugen nicht automatisch neue Entscheidungen. Neue Flanken, Baugebiete und Expansionsrisiken sind bewusste Layout-/Gameplayänderungen. Holdout nur nach Entscheidung über Ziel, Wellenökonomie, Gegner-Vorteile und Belohnung; [Missionsplanung](expeditions-missionsziele-und-holdout.md). Nicht beide Ausbauten gleichzeitig beginnen.
- **Geometriebezogene Materialalterung:** gegebenenfalls ein Cinder-Pact-Gebäude als Pilot für gebackene Kanten-/Vertiefungsmasken, sofern bei Spielzoom sichtbar. Kein Materialeditor oder teure Frame-Meshanalyse.
- **Multiplayer-Expeditionen:** eigener Regel-/Persistenzauftrag, nicht aus dem funktionierenden Transportprototyp ableiten. [Planung](multiplayer-expeditionen.md).

## Grenzen für spätere Strukturarbeit

- CPU-Welt, Darstellung, Sichtfilter und RNG-Reihenfolge schützen. Die gemeinsame Oberfläche verbindet Navigation, Picking, Fundamente und Höhenposen; kein zweites Landschaftsmodell.
- Bei Bewegungsdominanz einen während der Bewegung aktuellen Körperindex prüfen, nicht den innerhalb eines Ticks veralteten Kampfhash verwenden. Bei A*-Allokationsdominanz weltlokale Arbeitsfelder nur mit klaren Besitz-/Reentranzgrenzen. [Messkandidaten](mobile-performance.md).
- Modellhelfer aus tatsächlicher identischer Wiederholung gewinnen, nicht vorsorglich vereinheitlichen. Silhouetten und Bounds bleiben modelllokal.
- Renderer nur an fachlichen Besitzgrenzen auslagern, etwa Materialresidenz oder Renderzielverwaltung. Dateilänge allein begründet kein Refactoring; Struktur und Verhalten getrennt halten.
- ECS, Browserworker, allgemeine IK, Entity-Pooling, dynamische Terraformingwelt und Community-Kartenplattform zurückstellen, bis ein konkreter Engpass oder Produktauftrag den Aufwand rechtfertigt. Browserworker benötigen außerdem einen unverändert direkten `file://`-Ladevertrag.
