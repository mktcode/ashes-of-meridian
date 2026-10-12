# Projektprioritäten

Maßgebliche Übersicht der offenen Arbeit, keine Implementierungs- oder Testfreigabe. Details/Befunde bleiben im jeweiligen Fachissue; erledigte Historie in Git. Statischer Issue-/Quellen-/Testabgleich auf `2038076`, keine neuen Builds, Browser-, KI- oder Simulationsläufe. Implementiert mit offener menschlicher Abnahme ist kein unimplementiertes Feature.

## P1 – Verlässlichkeit und Kernspielbarkeit

| Issue | Wirkung und nächster Schritt |
| --- | --- |
| [Spielstand/Weltbesuche](expeditions-spielstand.md) | Evakuierungs-Startfehler muss einen vollständigen Menüstand hinterlassen; aktueller Fehlerpfad setzt nur die Ansicht um. Historischen Frontier-Seedfehler nach Generatoränderungen neu beurteilen. Save-Version-/Buildfrage, getrennte Speicherziele und Lebenszyklusabnahme bleiben offen. |
| [Navigation/Liveness](worker-bauwegfindung/issue.md) | Bekannte Bauweg-Fehlerklasse korrigiert, Originalstillstände und Worker-Langlaufbefunde offen. Gruppenankunft/Ausweichwackeln ist unabhängig von verbesserten FPS. Reproduzierbare Zustände vor Reload sichern. |
| [Prozedurale Gefechtsstarts](procedural-battlefields.md) | Bezahlten KI-HQ-Abschluss, knappe Wirtschaftsflächen, Ressourcenverkehr und Startfairness abnehmen; begrenzte Generatorproben beweisen keine laufende Partie. |
| [UI/Fokus/Dialoge](ui-review.md) | Dialogrolle, Fokusbindung/-rückgabe fehlen weiterhin; gemeinsame Verwaltung gezielt korrigieren. CSS-Entkopplung separat nachrangig. |
| [Performance/Stabilität](performance/README.md) | Dichte-Armee-FPS laut Nutzer verbessert, Auswahlhänger und Mobil-Freezes/Context-loss bleiben offen. Konkreten Nutzerabschnitt mit Build/Gerät eingrenzen; keine vorsorgliche Qualitätsreduktion oder pauschaler Engineumbau. |
| [Texturvorbereitung](texture-loading.md) | Fehler-/Residencyverträge technisch abgesichert; gezielter `file://`-Fehlerpfadcheck noch offen. Historischer Browserstart an Socket-Pfadlänge gescheitert, keine bewiesene Mobilabbruchursache. |
| [Testpflege/alte Fixtures](teststrategie-review.md) | Verbliebene HQ-/Mining-/Startannahmen fachlich berichtigen, bevor neue KI-/Balanceaussagen abgeleitet werden. Bereits korrigierte lokale Regelarenen nicht nochmals als unimplementiert führen. |

## P2 – zusammenhängende menschliche Abnahme

Nicht jedes offene Kästchen ist ein Bug. Gemeinsame Run-/Geräteblöcke statt separater Vollrunde je Fachissue; bestätigte Stillstände, Speicher- oder Bedienfehler nach P1 ziehen.

| Issue | Fokus |
| --- | --- |
| [Vollständige Runs/Geräte](playtest-validation.md) | Zentrale Run-Abnahme: Einstieg, Tutorial/Audio, FFA, Commands, Sieg/Niederlage, Reload und Touch. |
| [Citybuilding](citybuilding.md) | Forum-Lieferbereiche, Reload, Gründung/Wachstum, Drehung/Rückbau und dekorativer Verkehr. Freeze-Korrektur positiv rückgemeldet, Liefer-/Fortsetzungsfluss offen. |
| [Schwierigkeit/Progression](expeditions-schwierigkeit-und-upgrades.md) | HQ-Abschluss, Druck gegen passive Spieler, Ansammlung/große Armeen, tiefe Ressourcenstapel. Erst aktuelle Befunde, dann Balancing. |
| [Zivilisationsupgrades/Außenposten](civilization-upgrades.md) | Feste Angebote, Echo-Ränge, Wellenanstieg, Rettungsfenster, Dreierauswahl und einmalige Lieferungen in echten Runs. |
| [Mehrparteien-Prüfungen](mehrparteien-simulation.md) | Autonome FFA-/Wirtschafts-/Angriffsfälle erst nach Fixturepflege und eigener Prüffreigabe. |
| [Terrain/Wege/Höhen](terrain-generation.md) | Rampendurchsatz, Sicht von oben/unten, Fundamente, Picking, faire Wirtschaftswege und Walling; interessante Vergleichsseeds erhalten. |
| [Landschaften/taktische Darstellung](project-tomorrow.md) | Zentrale Bildabnahme einschließlich Desert/Westmark, Biotopen, Randkulisse, Kontrast/Nacht, Flugfreiraum und nassen Bodenakzenten. |
| [Modelle](modelle.md) | Rollen-/Teamlesbarkeit, Hangauflage und Nachtlichter in dichten Gruppen. Positive Nachtatmosphäre erhalten, kein allgemeiner Neubau. |
| [Upgrade-Gebäudemodelle](civilization-upgrade-models.md) | 36 Varianten implementiert; Rang-/Stillesbarkeit, Hang-/Nacht-/Siedlungswirkung und Variantenkosten im Spiel abnehmen. |
| [Schwere Luftzerstörer](schwerer-luftzerstoerer.md) | Integriert; Endgame-Konterbarkeit, KI-Ausgaben, Flugfreiraum und Darstellung prüfen. |

Modellkachel-Bild-/Touchabnahme unter [UI](ui-review.md#modellkacheln-bild-und-bedienung), Kosten ausschließlich unter [Performance](performance/README.md). Technische Prüfungen ersetzen keine visuelle/akustische/Echtgeräteabnahme.

## P3 – Pflege bei Bedarf

[Test- und Werkzeugpflege](teststrategie-review.md) führt verbleibende Dateischnitte, Werkzeugkonventionen, Scratch-Besitz und mögliche Dauerregressionen. Capture-/Ausgabegrenzen sind unter [Scene Capture](../scene-capture.md) und [Deployment](../deployment.md) dokumentiert; kein eigenständiger offener Capture-Umbau belegt. Die Pflege einer itch-Seitenbeschreibung im Repository bleibt eine bedingte Entscheidung.

CSS-Entkopplung aus [UI](ui-review.md#css-verantwortung) als getrennten strukturellen Schritt behandeln. ECS, Worker-Threads, IK, weitere Caches oder Pooling brauchen konkrete Befunde; Dateilänge allein ist kein Umbaugrund.

## Zurückgestellte Produktideen

Keine aktiven Fehler oder automatisch beschlossenen Erweiterungen. Vor Umsetzung Bedarf, Regeln und Abhängigkeiten einzeln entscheiden.

| Issue | Voraussetzung / Entscheidung |
| --- | --- |
| [Skirmish](new-battle-screen.md) | Parteien, Startbedingungen, Kartenauswahl und Profiltrennung nach stabilem Kernloop festlegen. |
| [Holdout](expeditions-missionsziele-und-holdout.md) | Begrenzter Missionspilot ist nicht der integrierte endlose Außenpostenmodus; eigenen Bedarf, Wellenetat und Belohnung klären. |
| [Weitere Vorteile](upgrade-ideas.md) | Ideenpool; bestehende Progression zuerst abnehmen, neue Stapel-/Aura-/Auszahlungsregeln einzeln entscheiden. |
| [Einzigartige Blickfänge](unique-points-of-interest.md) | Atmosphärische Motive, Platzierung und Geometriekosten definieren; keine zusätzlichen Ressourcen-/Missionsmechaniken. |
| [Android/Store/Werbung](android.md) | Browser-Mobilstabilität und Lebenszyklus zuerst, Verpackung/Store separat, Werbung später. |
| [Communitykarten](community-maps.md) | Skirmish-Regeln → begrenztes Schema/Beispielkarte → lokaler Import, Plattform/Sharing erst danach. |
| [Multiplayer](multiplayer.md) | Singleplayer-only. Ausnahme: Betreiber soll außerhalb des Repositories klären, ob Altdienst/Endpunkt läuft, gegebenenfalls abschalten. Kein automatischer Infrastrukturzugriff. |

## Nächste Arbeitspakete

1. **Evakuierungs-Fehlerpfad und Dialog/Fokus:** belegte Zustands-/Bedienungsgrenzen gezielt korrigieren; Generierungsfehler mit aktuellem Rezept gesondert beurteilen.
2. **Start-/Worker-Zuverlässigkeit:** verbleibende Fixtures berichtigen, Bauabschluss/Lieferzyklen prüfen; autonome Läufe nur separat freigegeben.
3. **Mobilstabilität/Fortsetzen und konkrete Auswahlhänger:** Gerät, Build, Szene und Abbruchzustand sichern, statt aus alten FPS-Werten eine Ursache abzuleiten.
4. **Ein zusammenhängender Run-/Geräteabnahmeblock:** Progression, Außenposten und taktische Darstellung gemeinsam prüfen; daraus konkrete Bugs/Balanceentscheidungen ableiten, erst danach neue Modi/Plattformen.

[Prüfwahl und Freigaben](../testing.md) bleiben verbindlich. Diese Priorisierung beauftragt keine Umsetzung und keine Langläufe.
