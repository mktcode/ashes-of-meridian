# Audit-Welle 01: priorisierte Pflegekandidaten

## Status und Aussagegrenze

Ausschließlich lesender Audit auf `2d991a42fde3e5a61467838619840cb3cfdce75a`; drei unabhängige Rollen für Dokumentation, Wartbarkeit und Performance. Der Hauptagent hat die unten genannten zentralen Quellenstellen gegengelesen und die Priorisierung korrigiert. Lauf-/Übergabenachweise: [Worktree-Testlauf](subagent-worktree-testlauf.md#freigegebene-audit-welle-01).

Das erste freigegebene Paket (CODE-1 und DOC-1) ist umgesetzt; unten verbleiben die noch nicht ausgewählten Kandidaten. Kein dringender breiter Strukturumbau belegt. Im lesenden Audit wurden keine Laufzeitmessungen, Tests oder Builds ausgeführt. Statische Kostenformen sind keine gemessenen Engpässe; insbesondere folgt daraus keine generelle Dringlichkeit einer Optimierung. Modelle, Assets, Shader und Styles wurden nicht vollständig geprüft; Grafik, Sound, externe Links und Echtgeräte bleiben außerhalb der Abnahme.

## Konkrete kleine Korrektur- und Absicherungskandidaten

- **CODE-2 – Ladegruppen vollständig absichern:** `tests/ashes-of-meridian-harness.check.cjs:80–130` filtert HTML-Skripte anhand bereits bekannter Gruppen. Ein nur im HTML ergänztes Fragment kann so unbemerkt außerhalb der VM-Gruppe bleiben. Der aktuelle Stand ist nicht als fehlerhaft belegt. Kleine Testergänzung: vollständige Zugehörigkeit und Reihenfolge der nach Pfad/Namenskonvention gruppierten Skripte prüfen. Keine automatische Ableitung oder Umstellung klassischer Skriptladung. Später Harness-Prüfung; übergreifende Ladeverträge am Schluss mit Gesamtsuite prüfen.

## Performance: erst Wirkung und Kosten abgrenzen

- **PERF-1/2 – Bewegung und Navigation:** `unitFits()` liest absichtlich Live-Körperpositionen (`src/simulation/movement.ts:4–19`); mehrere Probewege und Yield-Prüfungen vervielfachen Entitätsscans (`:36–68,123–197`). Potenziell wächst der Aufwand mit bewegten Einheiten × Gesamtentitäten, jedoch mit frühen Abbrüchen – kein bewiesener quadratischer Mindestaufwand. Echte A*-Suchen erzeugen rastergroße Typfelder (`src/world.ts:198–225`); direkter Sichtweg und Planungsdrossel begrenzen dies. Später getrennt Scanzahl/Eigenzeit/Yield-Ketten und A*-Aufrufe/Allokationen bei offenen Wegen, Engstellen und Gebäudeinvalidierung messen. Nicht einfach den innerhalb eines Ticks veraltenden Kampfhash einsetzen; RNG, Körperabstände und deterministische Reihenfolge schützen.
- **PERF-3 – Statische Geometrie in zwei Pässen:** Schatten- und Szenenpass zeichnen die statischen Batches bei Qualität > 0 (`src/renderer/runtime.ts:660–670,729–730`). Das ist ein Messansatz zum **bereits bekannten** [Desert-Mobilrisiko](desert-map.md), keine neue Entdeckung eines Flaschenhalses. Vorhandene Galerie-Zahlen wurden nicht nachgemessen. Später GPU-Passzeiten, Auflösung, Dreiecke und Speicher auf Zielgeräten trennen; keine Schatten-/Geometrieänderung ohne gesonderte visuelle Freigabe.
- **PERF-6/7 – Niedriger priorisiert:** KI-Nachbarschaftsbewertungen in `src/simulation/ai.ts:165–178,233–248` haben quadratische Anteile, laufen aber gedrosselt und teils nur bei bereiten Fähigkeiten. Erst bei Profilbeleg optimieren; stabile Gleichstands-/Zielregeln erhalten. Der einmalige Bodenmesh-Aufbau (`src/world-view.ts:15–34`, `src/renderer/runtime.ts:204–213`) rechtfertigt ohne Lade-/Heap-Problem ebenfalls keinen Umbau. Weitere Mikrooptimierungen nicht als eigenes Arbeitspaket verfolgen.

## Altlasten und Dokumentpflege: nicht pauschal bereinigen

- **CODE-3 – Ereignisreste:** `select` in `src/ui/core.ts:221` ist kein Mitglied von `GameEventMap` und damit ein kleiner statischer Restkandidat. `queued` und `build` sind dagegen emittierte Signale; ein fehlender UI-/Audioeffekt beweist keinen Vertragsfehler. Insbesondere wird `queued` im Simulationstest erwartet. Kein neuer Sound und keine Eventlöschung ohne fachliche Entscheidung.
- **CODE-4 – hold/stop/guard:** Aus der UI entfernte Befehle sind nicht automatisch aus dem Simulationsvertrag entfernt. `hold`/`stop` haben Testnutzer, `guard` ist über `command()` weiterhin erreichbar (`src/simulation/movement.ts:213–267`). Für die fehlende interne Guard-Erzeugung ist kein Löschbeweis erbracht. Umfangreiche Bereinigung der Bewegungs-/Kampfzustände derzeit nicht empfohlen.
- **CODE-5 – Optionale Pflichtmethoden:** Konkrete Produktionsinterfaces stehen optionalen Aufrufen und partiellen JS-Test-Doubles gegenüber. Supervisor-Entscheidung: heutige Testnutzung anerkennen; ohne belegten Produktionsausfall reine Vereinheitlichungspräferenz, kein notwendiges Refactoring. Wirklich optionale Callbacks unberührt lassen.
- **DOC-2/3 – Desert-Galerie und Vorprüfnotizen:** Ein persönlicher absoluter Galeriepfad ist nicht an sich falsch und wurde nicht auf Existenz geprüft. Technische Vorprüfungen und historische Lastzahlen sind nützlicher Kontext offener menschlicher Abnahme. Höchstens bei späterer Issue-Pflege die Galerie als lokale Hilfe kennzeichnen und entscheidungsrelevante Zahlen einem Stand/Verfahren zuordnen; nicht pauschal als veralteten Ballast löschen.

Klassische globale Skripte, Prototyperweiterungen und reservierte RNG-Aufrufe bleiben bewusste aktive Verträge. Kein belegtes Issue wurde als erledigt eingestuft. Bekannte Bauplatz-, Vent- und Crowd-Probleme sowie menschliche Abnahmen bleiben offen.

## Nächste Entscheidung

Als nächster kleiner Audit-Kandidat bietet sich CODE-2 an. Für Testumfang und Abgrenzung zu manueller UI-Abnahme gilt der [Prüfschwerpunkt im Prototyp](../testing.md#schwerpunkt-im-prototyp). Größere Simulations-/Renderoptimierungen erst nach beauftragten Messungen, nicht aufgrund dieser Auditliste automatisch beginnen.
