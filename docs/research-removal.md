# Ingame-Forschung entfernt

Historischer Bericht dieses Schritts. Anschließend wurden auch die [Beschreibungs- und Browser-Tooltips entfernt](tooltip-removal.md).

Das langfristige Ziel ist ein Roguelite mit Weiterentwicklung außerhalb der einzelnen Operation. Dieser Schritt entfernt die Ingame-Forschung, implementiert aber noch kein neues Fortschritts- oder Run-System. Die übrigen Tooltips werden anschließend separat bereinigt.

## Umsetzung

- `TECH` mit allen sechs Forschungsdefinitionen entfernt: Waffen, Rüstung, Förderung, Reichweite/Sicht, Regeneration/Sanitäterbonus und Antriebe.
- `game.s.upgrades`, `game.s.research`, `game.tech()`, Forschungsfortschritt, Abschlussereignisse und alle zugehörigen Bonusberechnungen entfernt.
- Forschungsreiter, Aktionen, Tooltips, Fortschritts-/Levelanzeigen, automatische Laborauswahl und Handbuchverweis entfernt. Das Kommandodeck hat **Command, Build und Recruit**.
- Die bisherige **Armor**-Anzeige war ausschließlich der Forschungslevel; sie entfällt. Schaden, Reichweite und Rohstoff-Restmengen bleiben sichtbar.
- Das baubare `lab`, seine Fraktionsnamen, Forschungswerte und sein Laboricon entfernt. Kein Startlabor mehr in Tier-3-Operationen und kein Labor mehr in der Menüvorschau. Es bleiben sieben baubare Gebäudetypen.
- Basiskosten, Bau-/Produktionszeiten, Fraktionseigenschaften, Schwierigkeit, Veteranenstatus und reguläre Heilung bleiben unverändert. Insbesondere bleiben Sanitäter und Fraktionsregeneration erhalten; entfernt sind nur die Forschungsboni darauf.
- **Permanente Fleet Upgrades bleiben erhalten:** `META`, `profile.upgrades`, deren Anwendung über `game.s.meta`, Hauptmenü-Kauf und Speicherung unverändert. Der intern noch `research` genannte Audiocue wird weiterhin beim Kauf dieser permanenten Upgrades benutzt und ist nicht ungenutzt.

### Schutzgeneratoren sind keine Forschung

Die Belagerungen **Operation 07 / Porcelain Mercy** und **Operation 11 / Silence Protocol** verwendeten zuvor den Gebäudetyp `lab` zusätzlich als Schutzgenerator. Diese Missionsziele dürfen nicht zusammen mit der Forschung verschwinden.

Sie verwenden nun `BUILDINGS.ward` mit `missionOnly: true`: nicht im Baumenü und von `canBuild()`/`build()` abgewiesen, ohne Baukosten, Bauzeit oder Forschungsfunktion. Sie behalten den Gebäudestatus für Kampf/Navigation, den Tag `generator`, ihre Positionen, 1050 Basis-Lebenspunkte, Radius 2,9 und das bisherige 3D-Modell. Die Auswahl zeigt ein Schildicon statt eines Laborkolbens. Schildauflösung und Siegbedingungen bleiben unverändert.

### RNG und Spielstände

Der entfernte Tier-3-Startspawn verbrauchte einen RNG-Wert für den anfänglichen Cooldown. Ein dokumentierter einzelner `random()`-Aufruf an dieser Stelle erhält die folgenden Spawn-/Ressourcen-Samples. Kein Platzhaltergebäude und kein Layout-Adapter. Eine **vor der Änderung** aus `187c936` erfasste Referenz für Seed 9897 prüft Kristallmengen und anschließende RNG-Werte. Bestehende Terrain-/Effekt-/RNG-Referenzen wurden nicht neu erzeugt.

Entitäts-IDs nach dem entfernten Startgebäude verschieben sich um eins; sein Hindernis und seine Sichtquelle entfallen absichtlich. Kein Versprechen eines identischen späteren Spielverlaufs. Terrainverteilung und Radien verbleibender Gebäude bleiben unverändert.

Aktuelle Snapshots enthalten keine Operations-Forschung mehr. Keine Migration älterer Spielstände; insbesondere sind gespeicherte `lab`-Entitäten kein unterstützter Typ mehr. Profildaten und permanente Upgrades werden nicht entfernt.

## Prüfungen

### Node

Vollständiger Pflichtbefehl aus [testing.md](testing.md#automatisierte-tests): **143/143 bestanden**.

Neue/angepasste Abdeckung:

- Alle 16 Kampagnenstarts und ein Tier-3-Gefecht: kein Labor/Forschungszustand, aktuelle Snapshots wiederherstellbar und Simulation danach ausführbar.
- Bauversuche für das entfernte Labor und reine Missionsgeneratoren werden ohne Zustandsänderung abgewiesen.
- Beide Belagerungen: Generatorzahl, Lebenspunkte, Kollisionsfläche, unverwundbare Zitadelle bis zum letzten Generator und anschließender Sieg.
- Basiswerte für Kampf, Bewegung, Transport, Raffinerie, Sanitäterheilung und Fraktionsregeneration ohne Forschungszustand; Fraktions-/Schwierigkeits-/Veteranen-/Schildmodifikatoren bleiben wirksam.
- Alle sechs permanenten Upgrade-Arten bleiben in Kampagnen wirksam; Übung/Gefecht erhalten sie weiterhin nicht.
- Drei Reiter, sieben Bauaktionen je Fraktion, keine Forschungsaktionen/Levelanzeige; Produktion und Rohstoff-Restanzeige bleiben erhalten.
- Zusätzliche feste Tier-3-Kristall-/RNG-Referenz; sämtliche bisherigen Referenzen bestanden unverändert.

### Browser unter `file://`

Chromium 152.0.7977.75, Linux/headless, Touch-Emulation, Performance, frisches temporäres Profil; kein Server und keine abgeschwächten Sicherheitsflags. Probe: `/tmp/meridian-research-check.cjs`.

Bestanden:

- Direkter Start, WebGL 2, Menüvorschau ohne Labor; Kauf eines permanenten Fleet Upgrades per nativem emuliertem Touch.
- Bei 960×600 alle drei Fraktions-Baumenüs mit sieben Gebäuden und drei Reitern; Depot-Platzierung aktivieren/abbrechen, Rekrutierung, Produktionsanzeige und aktuelle Checkpoints ohne Forschungszustand.
- Auswahl ohne Armor-Forschungslevel; Baumenü zusätzlich bei 390×844 gesichtet.
- Sichtbarer Court-Schutzgenerator mit Auswahl; Schild-/Siegablauf über die Live-Simulations-API geprüft. Die Node-Tests prüfen beide Belagerungen; kein vollständiges Durchspielen im Browser.
- Vorheriger Touch-Abbruchablauf erneut bestanden: sämtliche acht Zielmodi, Cancel zusätzlich bei 844×390 und 390×844, Pause/Speichern/Laden/Hilfe/Resume sowie regulärer Einzelarbeiter-Bau ohne Bauhilfe. Beim ersten Speichern wurde das Pausenmenü wie im [vorigen Bericht](mobile-touch-controls.md) beschrieben neu geöffnet; der lange Hilfedialog wurde vor dem Schließen per DOM gescrollt.
- Keine erfassten Laufzeit-, Ressourcen- oder Log-Fehler; abschließendes `gl.getError()` war 0.

Die Forschungsprobe hält die Tier-3-Szenen für gezielte UI-/Save-Prüfungen über die Live-API bei `speed = 0` an (kein neuer Spielmodus). Screenshots `/tmp/research-home.png`, `/tmp/research-build-faction-0.png`, `/tmp/research-build-portrait.png` und `/tmp/research-ward.png` gesichtet. Temporäre Proben/Bilder nicht eingecheckt; Browserprofil entfernt.

Nicht geprüft: echte Mobilgeräte, andere Browser, High/Balanced in diesem Ablauf, vollständige Missionen, Langzeitbalancing ohne Forschung, erneute vollständige Kamera-/Doppeltipp-Prüfung, hörbares Audio und Backup-Import/-Export im Browser. Die übrigen Tooltips sind noch vorhanden; ein neues Roguelite-Fortschrittssystem ist nicht implementiert.
