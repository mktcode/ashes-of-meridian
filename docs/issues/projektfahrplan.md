# Projektprioritäten

Planung, keine Implementierungs- oder Testfreigabe. Maßgebliche Übersicht für alle offenen Issues; Details und Befunde bleiben im jeweiligen Fachissue. Priorität folgt Ausfall-/Fortschrittsrisiko, Kernspielbarkeit, Nutzerwirkung und Abhängigkeiten. Ein kleiner belegter Fehler ist eher umsetzbar als eine große, noch unbestätigte Optimierung.

Reviewgrundlage: alle Issue-Texte, Abgleich betroffener Quellen/Tests auf `937914e` und vorhandene Nutzer-/Prüfbefunde. Keine neuen Spiel-, Browser-, KI- oder Simulationsläufe. „Implementiert, Abnahme offen“ ist weder ein neuer Implementierungsauftrag noch eine vollständige Freigabe.

## P0 – vor weiterer Veröffentlichung klären

| Issue | Einordnung und nächster Schritt |
| --- | --- |
| [Westmark: Quellen und Kartenabnahme](westmark-map.md) | Herkunft/Nutzungsfreigabe der weiterhin eingebetteten Bildquelle dokumentieren. Offene Rechteklärung, kein festgestellter Rechtsverstoß. Die künstlerische Kartenabnahme ist dagegen P2; keine ungefragte Assetlöschung. |

## P1 – Verlässlichkeit und Kernspielbarkeit zuerst

Die Tabelle ordnet Arbeitsfelder, nicht die Reihenfolge jedes Einzelschritts. Geräteabhängige Reproduktion und kleine belegte Korrekturen können unabhängig voneinander vorankommen.

| Issue | Status, Wirkung und nächster Schritt |
| --- | --- |
| [Mobile Performance/Stabilität](mobile-performance.md) | Laptop-Verbesserung bestätigt; mobile Freezes/Context-loss nicht geklärt. Zuerst Buildzuordnung und konkreten Gerätebefund sichern, dann Abbruch-/Befehls-/Armeelast getrennt eingrenzen. Kein weiterer pauschaler Grafikabbau. |
| [Spielstand/Weltbesuche](expeditions-spielstand.md) | Gefechtsrestore manuell positiv; frühere Welten samt Weiterbau und komprimiertem Archiv integriert, menschliche Abnahme offen. Hintergrund/Prozessende, Grafikverlust, getrennte Save-Ziele, verständliche Speicherfehler und Archivkosten zusammen mit Mobilstabilität abnehmen. |
| [Worker/Bauwegfindung](worker-bauwegfindung/issue.md) | Bekannte Fehlerklasse korrigiert, Originalstillstände nicht exakt reproduziert. Erreichbarer Bau, wiederholte Lieferungen und nachvollziehbarer Blockiert-/Ausgangsstatus vor weiterem Navigationsumbau. |
| [Prozedurale Gefechtsstarts](procedural-battlefields.md) | HQ-Bauflächen und KI-Ausweichen verbessert; tatsächlicher bezahlter HQ-Abschluss, knappe Wirtschaftsflächen und Startfairness offen. Ein unspielbarer Start wiegt schwerer als neue Karten-/Modellinhalte. |
| [Texturladefehler](texture-loading.md) | Im aktuellen Code belegter Fehlerpfad: fehlgeschlagene Pflichttexturen können als erfolgreich vorbereitet gelten. Kleine begrenzte Korrektur mit Fehler-/Parallelrequest-Regressionsfällen; keine angenommene Ursache der mobilen Abbrüche. |
| [UI/Fokus/Dialoge](ui-review.md) | Dialogrolle, Fokusbindung/-rückgabe fehlen weiterhin. Tastatur-/Screenreaderbedienung und sichere Bestätigungen betreffen den ganzen Spielablauf. Gemeinsame Dialogverwaltung gezielt korrigieren; CSS-Entkopplung bleibt P3. |
| [Teststrategie/alte Fixtures](teststrategie-review.md) | HQ-Sofortstart-Annahmen widersprechen dem Worker-Start. Betroffene Fixtures vor neuen KI-/Balanceaussagen fachlich berichtigen, Referenzen nicht blind ersetzen. Reine Testorganisation und weitere Laufzeitoptimierung sind nachrangig. |

## P2 – vollständiges Spiel und Darstellung gezielt abnehmen

Nicht alle offenen Kästchen sind Bugs. Menschliche Abnahme und neue technische Befunde unterscheiden; bei bestätigtem Stillstand, unbedienbarem UI oder falscher Sicht-/Bauentscheidung das konkrete Problem nach P1 ziehen.

| Issue | Fokus und Abhängigkeit |
| --- | --- |
| [Vollständige Runs/Geräte](playtest-validation.md) | Einstieg ohne Upgrades, FFA-Übergänge, Commands, Sieg/Niederlage und Reload zusammenhängend spielen. Zentrale menschliche Abnahme, nicht jede Fachliste als eigene Vollrunde wiederholen. |
| [Schwierigkeit/Progression](expeditions-schwierigkeit-und-upgrades.md) | HQ-Abschluss, passive Truppenansammlung und tiefe Ressourcenstapel nach den bestehenden KI-/Ökonomieänderungen bewerten. Erst Befunde, dann Balancing; neue Vorteilsideen separat. |
| [Mehrparteien-Simulation](mehrparteien-simulation.md) | Technische FFA-/Wirtschafts-/Angriffsnachweise gezielt nach Fixturepflege und ausdrücklicher Prüffreigabe. Alte Seed-/Pattbefunde sind keine Abnahme aktueller Weltrezepte. |
| [Höhen/Spielabnahme](hoehenstufen/README.md) | Sicht von oben/unten, Rampenverkehr, Fundamente, Picking und Walling auf der gemeinsamen CPU-Oberfläche prüfen. Worker-/Startprobleme nur im jeweiligen P1-Issue weiterverfolgen. |
| [Landschaften/taktische Darstellung](project-tomorrow.md) | Verdeckung, Bauflächen, Flugfreiraum, Kontrast/Nacht und alle sechs Familien einschließlich Mothership. Spielrelevante Lesbarkeit vor Wetter-/Materialfeinschliff. |
| [Modelle](modelle.md) | Rollen-/Teamlesbarkeit und Nachtlichtauswahl in dichten Gruppen; positive Rückmeldung zur Nachtatmosphäre erhalten. Kein allgemeiner Modellneubau. |
| [Modellkacheln](modell-kacheln.md) | Cache und Größenkorrektur sind integriert. Erst-/Wiederöffnen, mobile Bedienung und Ausschnitte abnehmen; verbleibende Kosten getrennt von der laufenden 3D-Kulisse messen. |
| [Schwere Luftzerstörer](schwerer-luftzerstoerer.md) | Bereits integriert. Endgame-Konterbarkeit, KI-Ausgaben, Flugfreiraum und Gerätekosten in passenden Run-Situationen prüfen, keine neue Einheit planen. |
| [Desert](desert-map.md) | Erodierte Formen/Bodenanschlüsse, warmer Charakter, Kontrast und faire Wege der aktuellen prozeduralen Fassung; kein Rückbau zum festen Layout. |

## P3 – Optionen und Pflege, nicht vorsorglich umsetzen

| Issue | Voraussetzung / Entscheidung |
| --- | --- |
| [Skirmish](new-battle-screen.md) | Nach stabilem Kernloop Regeln, Parteien, Startbedingungen und Profiltrennung entscheiden. Kein reiner Dialogbau ohne Spielmodusvertrag. |
| [Holdout](expeditions-missionsziele-und-holdout.md) | Eigenständiger Missionspilot erst bei begründetem Bedarf nach Run-Abnahme; Wellenökonomie, Belohnung und laufenden Spielstand festlegen. Nicht parallel mehrere neue Modi anfangen. |
| [Weitere Vorteile](upgrade-ideas.md) | Ideenpool, keine beschlossene Erweiterung. Bestehende Progression zuerst abnehmen; neue Stapel-/Aura-/Auszahlungsregeln einzeln entscheiden. |
| [Android/Store/Werbung](android.md) | Browser-Mobilstabilität und Lebenszyklus zuerst. WebView-/Storeentscheidung separat, Werbung noch später. |
| [Communitykarten](community-maps.md) | Skirmish-Regeln → begrenztes Datenschema/Beispielkarte → lokaler Import. Plattform/Sharing erst danach; kein vorhandener Kartenloader. |
| [Multiplayer](multiplayer.md) | Produkt weiterhin Singleplayer-only. **Ausnahme zur Zurückstellung:** zeitnah außerhalb des Repositories klären, ob ein alter Dienst/Endpunkt noch läuft, und gegebenenfalls durch den Betreiber abschalten lassen. Kein automatischer Infrastrukturzugriff. |

CSS-Entkopplung aus dem UI-Issue und nicht blockierende Testbereinigung bei fachlicher Pflege mitnehmen, nicht mit Verhaltensänderungen vermischen. ECS, Worker-Threads, IK, weitere Caches oder Pooling brauchen einen konkreten Befund; Dateilänge ist kein Umbaugrund.

## Empfohlene nächste Arbeitspakete

1. Quellenfreigabe und alten Dienststatus organisatorisch klären. Parallel bietet der belegte **Texturladefehler** den kleinsten klar abgegrenzten Codeauftrag; **Dialog/Fokus** ist der nächste bereichsübergreifende Bedienungsauftrag.
2. **Start-/Worker-Zuverlässigkeit:** relevante HQ-Fixtures berichtigen und gezielt Bauabschluss/Lieferzyklen prüfen. Autonome KI-Läufe nur separat freigegeben; fehlende Originalstände bei erneutem Auftreten zuerst sichern.
3. **Mobilstabilität und Fortsetzen:** eindeutige Diagnose-Buildkennung, konkrete Abbruchaufnahme und Spielstands-/Lebenszyklusabnahme zusammenführen. Weitere Performancearbeit nach dem verbliebenen Engpass, nicht nach der alten Menü-Himmel-Hypothese.
4. **Ein zusammenhängender Run-Abnahmeblock** mit FFA/Progression und taktischer Darstellung. Daraus konkrete Bugs/Balanceentscheidungen ableiten; erst danach einen neuen Modus oder Plattformausbau wählen.

Aufwand: Texturfehler/Buildkennung voraussichtlich klein, Dialogverwaltung/Fixturepflege mittel; Ursachenklärung bei Stillständen und Geräteabbrüchen offen. Das sind Umfangseinschätzungen, keine Zeit- oder Erfolgszusagen. Kriterien und Freigaben: [Prüfwahl](../testing.md).
