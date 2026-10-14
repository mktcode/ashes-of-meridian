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

Nach Änderungen an Auslieferungsdateien neu bauen: die Buildkennung beschreibt den
gebauten Payload, prüft aber nicht dessen Integrität zur Laufzeit.

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
