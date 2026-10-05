# Abgeschlossene Stages wieder betreten und weiterbauen

## Auftrag und Grenze

Vom Nutzer bestätigtes Ziel: Die Stage-Auswahl im Startbildschirm bestimmt Hintergrundszene und primäre Aktion. Aktuelle Stage → **Continue expedition**; abgeschlossene Stage → **Enter world**. Frühere Welten werden mit ihrer tatsächlichen Bebauung geladen und können dauerhaft weitergebaut werden. Das ist kein Zurücksetzen oder Verzweigen der Expedition.

Noch keine Implementierung. Der bestehende Vertrag steht in [Spielregeln](../gameplay.md#speichern-und-lebenszyklus) und [Architektur](../architecture.md#zustands--und-verantwortungsgrenzen); die unten genannten Änderungen sind geplant. [Bestehende Spielstandsabnahme](expeditions-spielstand.md) bleibt davon getrennt.

Nicht-Ziele: Replay, frei wählbare historische Autosaves, neue Gegner/Wellen, Ressourcen- oder Upgrade-Transfer zwischen Welten, neue Belohnungen/Scorewertung, Balancing, Offline-Fortschritt, Skirmish, Multiplayer und Rekonstruktion verlorener historischer Armeen. Pro abgeschlossener Stage genau ein fortschreibbarer Zustand, keine Snapshot-Historie.

## Zielverhalten

- Blättern verändert nur die Menüauswahl, nicht Expedition, Konten oder Simulation. Hintergrund und Aktion beziehen sich immer auf dieselbe erfolgreich vorbereitete Stage.
- Die ausgewählte alte Welt zeigt lebende Gebäude/Einheiten, deren Bauzustand und gespeicherte Tageszeit. Die bisherige Kamerazentrierung wird wiederverwendet. Vorschauen bleiben eingefroren und RNG-frei.
- **Enter world** stellt die alte Welt pausiert wieder her. Auswahl/Gesten, Effekte und Audio werden wie beim aktuellen Restore zurückgesetzt; Tutorial und Ankunftsfahrt werden nicht neu gestartet.
- Nach Resume laufen bestehende Bau-, Wirtschafts-, Produktions-, Bewegungs- und Fähigkeitsregeln weiter. Gegner bleiben ausgeschieden; keine neue Mission, kein erneutes Sieg-/Niederlage-Ergebnis.
- Alte Welt und aktuelle Stage behalten getrennte Konten, Erkundung, Kamera, Tempo, Aufträge, Kistenverbrauch und ursprüngliche Upgrades/Vorteile. Weiterbau erhöht weder Expeditionstiefe noch Civilization Score, Profilreserve oder Vorteilsstapel. Bereits erfolgte Auszahlung wird nicht wiederholt; gespeicherte lokale Konten werden nicht nachträglich umgerechnet.
- Besuche dürfen auch während einer offenen Vorteilswahl stattfinden. Die Wahl bleibt offen und wird nur beim Fortsetzen der eigentlichen Expedition bearbeitet.
- Autosave, Pause, Menü, Hintergrund/`pagehide` und bestmöglich Grafikverlust sichern das tatsächlich aktive Ziel. Die aktuelle Expedition wird durch einen Besuch niemals ersetzt.

Vorgeschlagene Beibehaltung der bisherigen Lebenszyklusgrenze: Das Weltarchiv gehört zum laufenden Run; Niederlage, bestätigter Abbruch oder bestätigte neue Expedition entfernen auch dessen Welten. Kein runübergreifendes Museum. Im Besuchs-Pausenmenü soll **Return to main menu** statt einer leicht verwechselbaren Abbruchaktion stehen; ein neuer Run bleibt im Startbildschirm ausdrücklich bestätigungspflichtig.

Vorgeschlagene Menüauswahl: Rückkehr aus einem Besuch zeigt wieder diese Welt einschließlich Weiterbau; frischer Seitenstart wählt wie bisher die aktuelle Stage. Keine neue Persistenz der Menüauswahl nötig. Globale Expeditionsvorteile/Score bleiben klar als aktuelle Expedition beschriftet, nicht als Vorteile der ausgewählten alten Welt.

## Befunde und tragende Änderungen

### 1. Datenmodell und Speicherung zuerst

`ExpeditionStagePreview` und `meridian.stage-history.v1` enthalten nur Stage/Karte/Seed. Sie sind heute bewusst kosmetisch und separat; sie dürfen nicht zur autoritativen Speicherquelle spielbarer Welten werden.

Geplant in `src/contracts.d.ts` und `src/persistence.ts`:

- Archivierte Welten im gemeinsamen Profil-/Expeditionsrecord besitzen; Auszahlung, Archivierung und nächste Stage werden durch denselben Schreibvorgang festgeschrieben. Bestehendes kosmetisches Archiv darf keine zweite maßgebliche Liste werden.
- Pro Eintrag Stage-ID innerhalb der besitzenden Expedition, vollständiges ursprüngliches Gefechtsrezept und CPU-Snapshot speichern. Rezept enthält insbesondere Tiefe, Encounter/Deployment/Mission/Gegner, Fraktion, Loadout und damalige Spieler-/Gegnervorteile. Keine rekursiv verschachtelten `MeridianExpedition`-Kopien samt weiteren Archiven.
- Gemeinsamen Rezept-/Snapshotvertrag für aktuellen Restore und Weltbesuch nutzen, ohne die aktuelle Expedition vorübergehend durch einen alten Record auszutauschen. `validExpeditionBattle` vergleicht momentan Tiefe, Seed, Parteien, Loadout und Vorteile mit der aktuellen Expedition; alte Welten müssen gegen ihr eigenes Rezept geprüft werden.
- Stage-Identität ausdrücklich übertragen; Karte/Seed allein sind keine sichere Welt-ID, auch nicht bei zufälliger Wiederholung derselben Kombination. Keine Archivzuordnung über profilweite Besttiefe.
- Archiv bleibt bei Einstellungen, Flottenkäufen, Vorteilswahl und aktuellem Autosave erhalten; kein Alias zwischen Live-Zustand und archivierter Wertkopie.
- Bereits vorhandene Landschaftseinträge besitzen keine historischen Armeen. Sie bleiben höchstens als klar bezeichnete Landschaftsvorschau ohne Eintritt verfügbar; weder frisches Gefecht noch erfundene Bebauung als Ersatz. Neue vollständige Einträge können auch nach einem bereits bestehenden aktuellen Spielstand entstehen. Keine Migration alter reiner Startcheckpoints oder Legacy-Adapter; beim Schemaentwurf bestehende gültige laufende Saves nicht beiläufig verwerfen.
- Beschädigte/inkompatible Welt niemals frisch starten oder still löschen. Fehler für das betroffene Archivziel getrennt von `battleSaveError` behandeln; ausdrückliches Verwerfen und Erhalt des aktuellen Saves planen. Beschädigte Originaldaten dürfen durch spätere Profilwrites nicht unbemerkt verschwinden. Unlesbares gesamtes JSON bleibt der bestehende globale Fehlerfall.

**Speicherbudget als frühes Entscheidungstor:** Jeder Weltstand enthält Entitäten, Sicht-/Belegungsraster und KI-Zustände. Der gemeinsame `localStorage`-Payload wächst, und jeder Autosave serialisiert alle archivierten Welten synchron. Bestehende Byte-/Dauermessung beibehalten; vor Festlegung des Umfangs repräsentative kleine und größere Archivpayloads gezielt abschätzen/messen. Kein heimliches Löschen ältester Welten oder vorsorglicher IndexedDB-Umbau. Wenn gemeinsamer Record für realistische Runs nicht tragfähig ist, Storage-Entscheidung vor Implementierung mit dem Nutzer klären. Quota-Ausfall behält die bestehenden flüchtigen Semantiken: gemeinsam neuer In-Memory-Stand, gemeinsam alter dauerhafter Stand nach Reload, Warnung vor Menüwechsel.

### 2. Sicheren Siegstand und abgeschlossene Spielphase einführen

Betroffen: `src/simulation/game.ts`, `src/simulation/runtime.ts`, `src/ui/core.ts`, `src/app.ts`.

- `checkHQElimination` entfernt die ausgeschiedenen Armeen und `finish` setzt `result`. Das UI verarbeitet das Event sofort, erhöht Tiefe, tauscht Encounter/Vorteile aus und setzt `battle = null`.
- Das Event entsteht **innerhalb** von `stepTick`. Danach folgen noch Ergebnisuhr, Sichtaktualisierung und Entitätsbereinigung. `snapshotBattle` verbietet laufende/fehlgeschlagene Ticks sowie Ergebniszustände. Der letzte Autosave ist daher kein korrekter Siegstand und ein Snapshot im Event wäre unsicher.
- Ergebnisabschluss für die Archivierung bis zur erfolgreichen Tickgrenze verschieben: ursprüngliches Rezept bis dahin behalten; dann vollständigen Siegstand kopieren und zusammen mit einmaliger Auszahlung/nächster Stage speichern. Keine Auszahlung/Archivierung eines partiellen Ticks bei Fehler nach dem Ergebnis-Event. Direkte Ergebnisaufrufe außerhalb eines Ticks und wiederholte Events müssen weiterhin wohldefiniert bleiben. Keine neuen Zufallsziehungen; bisherige Gegner → Karte → Seed-Reihenfolge schützen.
- Explizite abgeschlossene Spielphase in den Einzelspieler-Regeln/Snapshotvertrag aufnehmen. Beim Archivieren nur die Kopie für den Besuch vorbereiten; die sichtbare ursprüngliche Ergebnisszene bleibt beendet. Im Besuch ist `result = null`, damit bestehende UI-/Bau-/Tickguards weiter funktionieren, aber Mission und `finish` sind dauerhaft gesperrt. Nur `result` zu löschen würde sofort erneut gewinnen und auszahlen.
- Keine neue dritte Variante von `rules.kind` ohne Bedarf: viele Verträge unterscheiden Einzelspieler und Szenario, einschließlich Effekt-RNG und Aktionen. Abgeschlossene Phase innerhalb des Einzelspieler-Vertrags ist der engere Ansatz; Validator prüft aktuelle und archivierte Phasen ausdrücklich.
- Gegner-Eliminierung, Kistenverbrauch, Zeit/RNG, Navigation samt `navDirty`, Sicht und Hash-Mitgliedschaft erhalten. Keine künstliche Wiederbelebung, kein neuer Startbonus und kein pauschales Reveal.
- Bestehende Umweltgefahren und bereits abgefeuerte Geschosse bleiben unverändert; der Besuch wird nicht beiläufig zu einem schadensfreien Kreativmodus. HQ-Verlust im Besuch darf keine Expeditionsniederlage erzeugen. Keine automatische Rettung/Worker-Erzeugung; entsprechende Spielbarkeitsgrenze offen kommunizieren.

### 3. Aktives Speicher-/Ladeziel vom Expeditionsfortschritt trennen

Betroffen: `src/ui/core.ts`, `src/ui/screens.ts`, `src/ui/input.ts`, `src/ui/tutorial.ts`, `src/app.ts`.

- Explizites aktives Ziel: aktuelles Gefecht oder archivierte Stage. `this.expedition` bleibt stets die fortschreitende Expedition. `saveBattle` prüft und aktualisiert das aktive Ziel statt ausschließlich `s.map/seed/depth` gegen den aktuellen Encounter zu vergleichen.
- Start-Event/Tutorial-Restore lesen aus dem tatsächlich geladenen Snapshot, nicht aus `this.expedition.battle`. Ergebnisverarbeitung erhält zusätzlich eine harte Schranke gegen Auszahlung/Fortschritt aus Besuchswelten, auch bei versehentlich zugestelltem Ergebnis-Event.
- Lader für Eintritt und Continue gemeinsam nutzen, aber mit explizitem Rezept/Snapshot/Ziel. `onLaunchBattle` prüft heute `expedition === ui.expedition`; Zielidentität und Request-Token müssen auch einen Archivstart und veraltete abgeschlossene Ladejobs absichern.
- Speichern vor Zielwechsel/Entladen, einmaliger Launch, pausierter Restore und keine vorzeitigen Änderungen des aktiven Ziels bei fehlgeschlagener Validierung/Texturvorbereitung.
- Neue Expedition, Abbruch, Verwerfen, Menü und Dialogrückkehr prüfen: keine veraltete Archiv-ID, kein falscher Speicherfehlerdialog, kein versehentliches Verwerfen der gesamten Expedition aus einem Weltfehler heraus.

### 4. Hintergrund und primären Button gemeinsam umstellen

Betroffen: `src/world-view.ts`, `src/app.ts`, `src/ui/screens.ts`, `src/ui/templates.ts`, `src/ui/input.ts`.

- `savedBattleMenuScene` nimmt den explizit ausgewählten Snapshot; die vorhandene Kamera-/Entitätslogik bleibt gemeinsam. `previewEntities` und `previewSavedBattle` müssen auch historische Szenen berücksichtigen, damit diese ihre gespeicherte Tageszeit und den normalen Battlefield-Himmel statt der seedbasierten leeren Menü-Himmelskulisse erhalten.
- Snapshot-/Stage-Ziel durch die asynchrone Vorschau einschließlich `previewChange` tragen, nicht erst über den nachträglich aktualisierten `stagePreviewIndex` ermitteln. Während des Übergangs gibt es heute einen Zeitraum mit neuem Hintergrund und noch alter UI-Auswahl; Eintritt/Continue in dieser Zeit sperren.
- Nach erfolgreicher Vorbereitung Auswahl, Label, Tooltip, Aktionsziel und Button gemeinsam aktualisieren: **Continue expedition** oder **Enter world**. Bei fehlendem historischen Snapshot Eintritt sperren und den Landschaftscharakter erklären.
- Startbildschirm-Aktion ausdrücklich von `continueExpedition` trennen: Ergebnis-/Übergangsbuttons müssen unabhängig von einer früheren Menüauswahl immer die aktuelle Expedition fortsetzen.
- Mehrfachklicks, Modalwechsel, Codex, Home-Neuaufbau, fehlerhafte/von neuem Request überholte Vorschauen, Reduced motion und Texturladefehler berücksichtigen. Ein verspäteter Abschluss darf weder Szene noch Button auf das falsche Ziel setzen.

## Reihenfolge und gezielte Nachweise

1. Daten-/Phasenvertrag und Speicherbudget entscheiden; dann Persistenz/Validator mit Wertkopien und Archivfehlergrenzen umsetzen.
2. Siegabschluss an sicherer Tickgrenze sowie Archiv-Restore/Weiterbau implementieren.
3. Aktives UI-Ziel und alle Save-/Lebenszykluspfade integrieren.
4. Stage-Vorschau, englische Aktion und Navigation integrieren; anschließend nur die betroffenen dauerhaften Verträge dokumentieren.

Keine breite Suite nötig, solange die Risiken gezielt prüfbar bleiben. Build einmal am jeweiligen integrierten Quellstand; kleinste betroffene Fälle nach [Prüfregeln](../testing.md):

- `tests/ashes-of-meridian-persistence.check.cjs`: Siegarchiv + Auszahlung + nächste Stage atomar; Reload/Profilwrites/Vorteilswahl; ursprüngliche Vorteile/Startupgrades; Fremd-/Doppel-IDs, Phase/Rezeptfehler; Quota und flüchtige Fortsetzung; kein Fallback eines defekten Archivs zum Gefechtsstart.
- Kleine CPU-Fixture dort: echter Sieg im Tick, erst anschließend archivieren; Fehler nach Result-Event verhindert Abschluss; Archiv-Restore und begrenzte Wirtschaft-/Baufortsetzung; Kamera/Tempo/RNG/Sicht/Navigation/Kisten erhalten. Keine KI-Partie oder Langsimulation.
- `tests/ashes-of-meridian-controls.check.cjs`, gezielte Stage-/Save-/Resultfälle: ausgewähltes Ziel, Pause/Resume, Autosave/`pagehide`, Warnung vor ungespeichertem Menüwechsel, alte Welt weiterbauen und erneut laden, aktuelles Gefecht unverändert, offene Vorteilswahl unverändert, harte Auszahlungs-/Score-/Tiefe-Sperre, Abbruch/Ersetzen und veraltete Launches.
- `tests/ashes-of-meridian-menu-scene.check.cjs`: tatsächliche historische Bebauung, Kamera und Zeit; keine Mutation/RNG-Nutzung, kein Army-Borrowing bei gleicher Karte oder Seed.
- `tests/ashes-of-meridian-presentation.check.cjs`, gezielte Home-/Appfälle: explizites Ziel durch asynchrone Preview, Tageszeit/Himmel, Klicks während Laden/Blend, stale Completions, Reset bei Codex/Weltwechsel und unterschiedliche Welt-/Rastergrößen.
- Bestehende Negativannahmen „Archiv immer leer“ und „Continue trotz anderer Auswahl immer aktueller Checkpoint“ gezielt ersetzen; übrige Schutzverträge erhalten. UI-Ergebnisfixtures müssen echte snapshotfähige Zustände benutzen statt nur `{ win: true }`.

`test:ai`/`test:simulation` und direkte/gefilterte Fälle daraus nur nach neuer ausdrücklicher Nutzerfreigabe. Keine Referenzregeneration. Browsercheck nur bei konkret offenem technischem Lade-/Lebenszyklusrisiko; englische Verständlichkeit, sichtbarer Szenenwechsel, Weiterbau und Geräte-/Storagekosten bleiben menschlich abzunehmen.

## Betroffene Dokumentation bei Umsetzung

- `README.md`: Einstieg erklärt Auswahl und **Enter world** statt rein kosmetischer Pfeile.
- `docs/gameplay.md`: Besuchsregeln, getrennte Konten, keine erneute Wertung, Speicher-/Rungrenzen.
- `docs/architecture.md`: autoritatives Weltarchiv, sichere Ergebnis-Tickgrenze, aktive Zieltrennung und Snapshotphase.
- [Spielstandsabnahme](expeditions-spielstand.md) und [Run-Abnahme](playtest-validation.md): die bisherigen historischen Ausschlüsse/Continue-Annahmen erst mit Umsetzung ersetzen und menschliche Grenzen passend verlinken. Nach vollständiger Erledigung dieses Issue löschen; keine zusätzliche Änderungshistorie führen.
