# Getrennte Alloy-Vorkommen und Altstandkorrektur

Gezielte Verhaltenskorrektur nach `2817f5d`, ausgelöst durch den Screenshot mit zwei nahezu deckungsgleichen Kristallmodellen, Auswahlringen und Namen.

## Ursache und neue Verteilung

`MeridianGame.start()` erzeugte je Standort fünf Kristallentitäten mit `j * 2.1 + i * 0.8` als Winkel. Drei Schritte ergeben bereits ungefähr einen Vollkreis: Slot 3 liegt fast auf 0, Slot 4 fast auf 1. Es war kein doppelter Renderaufruf.

`crystalPosition()` verteilt weiterhin **fünf** Vorkommen je Standort, jetzt mit `2π / 5` Winkelabstand. Acht Standorte, IDs, Reihenfolge, Alloy-Mengen, Gasvorkommen, Ellipsenradien 3,9/3,0 und Kollisionsradius 1,3 bleiben erhalten. Der kleinste gemessene Mittelpunktabstand ist jetzt etwa **3,527** Welteinheiten statt nahezu null.

Am östlichen Standort (Index 5, 65/6) verwendet die Ellipse Phase 4,7 statt 4,0. Die erste Probe der regelmäßigen Verteilung fand dort eine Überschneidung mit der bestehenden Startfabrik bei 58/11: Abstand etwa 5,030 bei summierten Kollisionsradien 5,1. Die gedrehte Anordnung lässt eine Lücke zur Fabrik; kein Gebäude oder Hindernis wird verschoben.

Die Korrektur verändert bewusst Laufwege, Auswahl und potenziell den zeitlichen Abbauverlauf. Sie verspricht daher **keine unveränderten Einkommenszeitpunkte oder späteren RNG-Zustände**. Anzahl/Reihenfolge der RNG-Aufrufe beim Start, Anfangsmengen und Folge-RNG direkt nach Start bleiben gleich. Terrain, Hindernisse, Meshrendering und deren feste Referenzen sind unverändert.

## Kompatibilitätsplan für Version-1-Operationen

- Keine neuen Save-Felder, Versionsnummern oder Storage-Schlüssel; Backup-Format ebenfalls unverändert. Dieselbe Korrektur greift bei Checkpoint-/Continue-Laden und beim Laden einer importierten Operation.
- `restore()` arbeitet weiter auf einer Kopie. Nach Weltkonstruktion und Aufbau des Gebäuderasters, vor ID-/Raumindexaufbau, ruft es `repairLegacyCrystalPositions()` auf. Erkannt werden ausschließlich lebende Kristalle an den früheren generierten Positionen, mit einer Toleranz von 1e-8. Beliebige nahe oder benutzerdefinierte Vorkommen werden nicht pauschal verschoben oder zusammengelegt.
- Neue Zielpositionen werden pro Standort gemeinsam geplant. Bei unverändertem Standard-Altstand werden 33 Positionen korrigiert: Slots 1–4 überall, zusätzlich Slot 0 am östlichen Standort.
- Bereits vorhandene Gebäude, Ressourcen und Ziele bleiben unverändert. Standardziele müssen im Terrain-/Gebäuderaster frei sein und mit `size + size + 0,8` Abstand zu lebenden nicht mobilen Entitäten und anderen geplanten Vorkommen sein. Unverstellte Standardplätze werden zuerst reserviert. Für blockierte Plätze erfolgt eine deterministische Suche um das Ziel: Radien 1–16, je 32 Richtungen, ohne RNG. Das Abstandsmaß ist konservativer als der reine Modell-Kollisionsradius.
- Gibt es keine sichere Gesamtanordnung innerhalb dieses Suchbereichs, wird **dieser Standort nicht verändert**. Das ist ein bewusst nicht destruktiver Rückfall für vollständig verbaute oder ungewöhnliche Altstände, keine Garantie zur Reparatur beliebig manipulierter Karten.
- IDs, Restmengen, HP, Trägerladungen, Aufträge und Warteschlangen bleiben erhalten. Erschöpfte/tote und fehlende Vorkommen werden nicht wiederhergestellt oder aufgefüllt. Nur aktive, nicht zum HQ zurückkehrende Arbeiter auf Mining-Auftrag zu einer verschobenen ID verlieren den veralteten Weg (`path`, `pi`, `nextPath`, `pathGoal`); ihre nächste Bewegung berechnet ihn zum neuen Ziel. Andere Arbeiter-/Einheitswege bleiben unverändert.
- Keine automatische Storage-Schreibmigration: Der importierte/gespeicherte Altstand bleibt bis zum normalen Speichern bestehen. Korrigierte Positionen werden beim nächsten Save/Backup übernommen. Bereits korrigierte Saves ändern ihre Entitätsdaten beim erneuten Laden nicht weiter.
- Für eine bereits im Browser laufende Partie: **erst speichern, dann Seite neu laden und den Spielstand fortsetzen**. Ein Neustart der Partie ist nicht erforderlich.

## Ausgeführte Prüfungen

**127 Node-Tests bestanden**, vollständiger [Testbefehl](testing.md#automatisierte-tests), Node.js `v23.11.1` / Linux, 128-MiB-JS-Heaplimit und ein Worker.

Sieben neue Kristallprüfungen ergänzen die fünf Modelltests:

1. Alle 16 Kampagnenstarts plus fünf Gefechtsstarts mit unterschiedlichen Seeds/Biomen und verteilten Fraktionen: 40 getrennte Kristalle auf fünfteiligen Ellipsen, acht Gasvorkommen, unveränderte Radien, begehbare Mittelpunktzellen und keine Überschneidung mit tatsächlichen Startgebäude-Kollisionsradien.
2. Alle 40 Anfangsmengen/IDs und fünf nächste RNG-Werte gegen einmalig aus unverändertem `2817f5d` erfasste Werte.
3. Neuer Save nach 100 Schritten: unveränderte Entitätsdaten beim Restore; kein nachträgliches Verstellen gültiger Mining-Wege, keine RNG-Nutzung durch Reparatur.
4. Alter Save mit teilweise abgebautem, totem, entferntem und benutzerdefiniertem Vorkommen: Eingangsdaten unangetastet, IDs/Mengen/Aufträge erhalten, erforderlicher Mining-Weg gelöscht, Rückkehrweg erhalten, Wiederholung idempotent.
5. Im ursprünglichen Layout laut echtem `canBuild()` zulässiges Depot bei -60,3/45,3 blockiert einen neuen Platz: Ausweichanordnung deterministisch, getrennt und weiterhin auf begehbaren Zellen, Gebäude und Alloy unangetastet, weiterer Restore stabil.
6. Injiziert vollständig blockierte Welt: Standortkorrektur bleibt atomar und ohne RNG, keine Datenverluste.
7. Arbeiter mit altem Weg zu ID 16 erreicht nach Restore das verschobene Vorkommen; 1.000 feste Schritte fördern und liefern Alloy.

Zusätzlich fünf Mutationen in nur VM-geladenem Code erkannt: alter Winkelabstand, deaktivierte Restore-Korrektur, aufgefüllte Restmenge, fehlende Mining-Pfadinvalidation, übersprungener Gebäudeabstand. `/tmp/meridian-crystal-mutation.cjs`; keine Änderungen an Repository-Quellen durch die Mutationsprobe.

### Unveränderte historische Fixtures

`operation-v1.json`, `presentation-v1.json` und alle Layout-/Effekt-Zeichenreferenzen wurden **nicht neu erzeugt**. Der Fünf-Sekunden-Simulationsvergleich und die sechs historischen Effektszenarien stellen mit `tests/helpers/legacy-crystal-layout.cjs` ausdrücklich die alten Ressourcenpositionen als Szenarioeingabe her. So bleiben ihre ursprünglichen Snapshot-/Effekt-/RNG-Erwartungen sinnvoll, ohne die fehlerhafte Verteilung für neue Spiele festzuschreiben. Neue Starts und Migration testen separat ohne diesen Helfer. Der Restore-Referenztest lässt nur die konkret beschriebenen Koordinaten und Mining-Pfaddaten abweichen und vergleicht den restlichen vollständigen Zustand weiter.

### Browser unter `file://`

Frischer Chromium `152.0.7977.75`, Linux/headless, temporäres Profil, keine abgeschwächten Sicherheitsflags. `/tmp/meridian-crystal-browser.cjs`, Phase `crystal-spacing`:

- Alter Version-1-Backup-Container über den echten Datei-Input importiert; roher Storage-Inhalt zunächst unverändert. Normales `ui.load()` korrigiert 33 Positionen, keine ID oder Restmenge verloren. Speichern und erneutes Laden erhalten die korrigierten Entitäten exakt.
- Für ein Vorher-Bild wurden ausschließlich im temporären Browserzustand die alten Koordinaten wieder eingesetzt; native Maus über ID 15 bei ausgewählter ID 12 reproduziert die doppelten Labels. Danach erneut regulär geladen, keine Probe-seitige Positionskorrektur.
- Je zehn Vorkommen am Heimat- und östlichen Standort, sowohl migriert als auch frisch: **20 echte Hover- und Einzelklickprüfungen**, jede trifft die erwartete eigene ID. Kamera/Erkundung für die Probe vorgegeben, Simulationsgeschwindigkeit auf null, Eingabe/Renderloop weiterhin aktiv. Kein Anspruch auf natürliches Erkunden aller acht Standorte.
- Native Rechtsklickbestellung eines Arbeiters ergibt Mining auf ID 16. Anschließend 1.000 direkt ausgeführte feste Simulations-/Effektschritte liefern 648 Alloy im geprüften frischen Szenario.
- Vorher-/Nachher- und östliche Standortbilder visuell geprüft. Ergebnisse `/tmp/meridian-crystals-browser.json`, Bilder `/tmp/meridian-crystals-*.png`. Der alte Zustand zeigt drei überlagerte Gruppen, der neue fünf getrennte Vorkommen.
- Erweiterter Spiel-/WASD-/Maus-/Bau-/Rekrutierungs-/Save-/Reload-/Backup-/Audio-API-Ablauf und MSAA-Probe weiterhin bestanden. Vier reguläre Shaderprogramme verlinkt, vier Bild-Uploads, keine erfassten Laufzeit-/Konsolen-/Ressourcenfehler.
- Ein erster umfangreicherer Mausdurchlauf erreichte das 90-Sekunden-Zeitlimit und ist kein vollständiger Prüfnachweis. Der abgeschlossene Lauf nutzt die gezielten zwei Standorte und ein längeres Probenzeitlimit. Zurückgebliebenes Testprofil separat entfernt; keine Nutzersaves berührt.
- Dokumentationslinks/Anker und `git diff --check` geprüft.

Offen: andere Browser/Grafikhardware, HTTP, beliebige Altstände oder vollständig verbaute Karten, echte Langzeitpartien und vollständige Kampagnen, Hörtest und systematische Performance. Node-Tests sind kein WebGL-Nachweis; die Browserprüfung deckt nicht sämtliche Standorte und Missionszustände interaktiv ab.
