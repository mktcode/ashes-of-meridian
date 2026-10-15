# Systemgrenzen

Nur übergreifende Entscheidungen, die aus einer einzelnen Funktion nicht hervorgehen.
Typen, Algorithmen, Werte und lokale Invarianten stehen in Quellen und Tests.

## Auslieferung

`file://` ohne Server ist ein Produktziel. Deshalb klassische synchron geladene
Skripte mit globalen Bindungen, keine Laufzeit-Imports, CDN, `async` oder `defer`.
Neue Skripte in HTML und betroffenen Gruppen von `tests/helpers/game-scripts.cjs`
eintragen; Ladereihenfolge und CSS-Kaskade sind Verträge. Klassenfragmente verwenden
nicht aufzählbare Prototypmethoden und TypeScript Declaration Merging.
`map-viewer.html` verwendet dieselbe App, keinen eigenen Renderer oder Scriptkatalog.

Das private Crowd-Workspace ist vom Spiel getrennt. Sein CPU-Kern besitzt Bewegung,
Navigation und Reservierungen; die Referenzdemo besitzt Modelle, WebGL, Kamera und
Picking. Interne Module werden beim Build in ein klassisches synchrones Browser-Bundle
übersetzt; das ändert den `file://`-Vertrag nicht. Node-Verbraucher erhalten einen
separaten Moduleinstieg. Eine spätere Spielanbindung muss den Besitzer der Körperpositionen
eindeutig festlegen, nicht zwei Bewegungssimulationen auf denselben Körper anwenden.

Das unabhängige Landscape-Workspace importiert gespeicherte STRATA-Höhen und erzeugt
ein CPU-Mesh. Sein optionaler Crowd-Adapter verwendet die Factory des Verbrauchers,
keine zweite Crowd-Laufzeit. Die eigenständige Terrain/Crowd-Demo bündelt Import und
UI für `file://`; sie ist weder Editorübernahme noch Anbindung an die Spielsimulation.

Nach Änderungen an Auslieferungsdateien neu bauen: die Buildkennung beschreibt den
gebauten Payload einschließlich Crowd-Demo, prüft aber nicht dessen Integrität zur Laufzeit.

## Zustand und Lebenszyklus

- Simulation besitzt CPU-Welt und Regeln, nicht Renderer oder DOM. Feste Ticks,
  Renderbudget und UI-/Audiouhren sind getrennt; Spieltempo skaliert Simulationszeit.
- UI orchestriert und speichert, ist aber keine Berechtigungsgrenze. Aktionen werden
  in der Simulation validiert; angenommene Szenarioeingaben sind noch keine erfolgreichen Aktionen.
- Ein gemeinsamer Profilwrite sichert Auszahlung, Weltarchiv und Expeditionsfortschritt.
  Weltbesuche ersetzen niemals das aktuelle Expeditions-Speicherziel. Stage-IDs gelten
  innerhalb ihrer Expedition, Karte/Seed allein identifizieren keinen Archivplatz.
- Snapshots nur an sicheren Tickgrenzen; partiell fehlgeschlagene Ticks nicht sichern.
  Start und Restore sind getrennt. Terrain wird aus dem versionierten Rezept erzeugt:
  Rezeptänderungen erfordern eine Expeditionsversionsänderung, keine stille Neugenerierung alter Saves.
- Keine Migration, kein Offline-Fortschritt, keine koordinierte Mehrtab-Persistenz.
  Speicherfehler machen den Dienst für die Seite dauerhaft flüchtig; beschädigte
  Saves bleiben bis zum expliziten Verwerfen erhalten. Kein zugesicherter Rollback
  bei Fehlern nach begonnener Auszahlung und kein automatischer Retry.
- View-Caches, Effekte und dekorativer Verkehr sind kein autoritativer Weltstand.
  Ressourcenbesitz und Freigabe müssen Welt-/Objektwechsel, Resize und Grafikverlust berücksichtigen.

## Welt und Zufall

Eine triangulierte CPU-Oberfläche ist maßgeblich für Bodenhöhe, Navigation, Picking
und Darstellung: genau eine spielbare Höhe je X/Z. Decks und Außenkulisse schaffen
keine zweite Spielebene. Kosmetik darf weder CPU-Blocker noch Sichtrechte verändern.

Öffentliches Terrain, Wirtschaft und Dekor entstehen vor privater Parteienzuteilung.
Technische IDs für Partei, Fraktion, Karte und Entität sind unabhängig von Anzeigenamen.
KI handelt mit bezahlten Aktionen und verzögerten beobachteten Kontakten, nicht versteckten Live-Daten.

RNG-Aufrufreihenfolge ist Verhalten. Neue Kosmetik verwendet eigene stabile Seedquellen;
reservierte Samples nicht als toten Code löschen. Bestehende CPU-Effekte ziehen teilweise
Simulations-RNG und dürfen bei Unsichtbarkeit nicht einfach entfallen. Zeichnen zieht keinen RNG.
Seed allein konserviert keine Landschaft über Rezeptänderungen hinweg und beweist keinen Lockstep.
