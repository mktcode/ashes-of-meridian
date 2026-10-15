# Zu weitläufige Crowd-Parkformationen

Offener Befund der unabhängigen Crowd-Simulation, nicht der Spielnavigation.

## Ursache und Abgrenzung

Beim Aufbau einer neuen Formation bestimmt der größte bereits vorhandene Körper
in der **gesamten Welt** die Durchgangsbreite zwischen allen Standplätzen.
`moveTo` in `packages/crowd-simulation/src/world.js` wählt dieses Profil;
`places` in `src/navigation/navigation.js` reserviert damit flächendeckend breite
Gassen. Auch gruppenübergreifende Reservierungen berücksichtigen diese globale Breite.
Ein einzelner entfernter Panzer genügt, selbst ohne Weg durch die Marine-Formation.

Die Freihaltung schützt Erreichbarkeit zwischen bereits geparkten Körpern, verteilt
kleine Einheiten aber unnötig großflächig. Einfach enger stellen ist kein geprüfter
Fix: Endankünfte und spätere Durchgänge dürfen dadurch nicht blockieren.
Das Verhalten bestand bereits vor dem Terrainvertrag; kein neuer Rechteck-/Firefoxfehler.
Bereits reservierte Formationen werden bei späteren größeren Spawns nicht umgestellt.

## Begrenzte Reproduktion

Verglichen wurden `14edb4f` und `401ad5f`: flache 128 × 128-m-Karte im 0,5-m-Raster,
keine Hindernisse, unveränderte Demo-Profile. 24 Marines starten bei (-16, 0) und
laufen zum Gruppenziel (12, 0). Optional stehen ein oder vier gehaltene Panzer
mit Spawnursprung (-30, 30) weit außerhalb des Zielbereichs.

Ohne Panzer beträgt der nächste Marine-Mittelpunktabstand 1,75 m; mit bereits
einem Panzer 3,75 m. Bei unverändertem Marine-Durchmesser bleiben damit 0,95 m
beziehungsweise 2,95 m zwischen den Kollisionskörpern. Alle Marines erreichten
exakt ihre reservierten Plätze und blieben weitere 60 Ticks fest; die Panzer
bewegten sich nicht. Positionen, Abstände und Ankunftsticks waren vor/nach dem
Terrainvertrag exakt gleich. Das belegt die Ursache, nicht den vollständigen
Live-Zustand des vom Nutzer fotografierten Firefox-Fensters.

## Offen

- [ ] Kompakte Standplatzwahl und notwendige Durchgangsfreihaltung voneinander
  trennen, statt jede Marine-Lücke für den größten Körper der Welt auszulegen.
- [ ] Eine Umsetzung mit vollständigen Ankünften, Gegenverkehr, stehenden/neu
  hinzugefügten großen Körpern und stabilen bestehenden Parkplätzen absichern.
- [ ] Körperradien, Hindernisse und geometrische Freistellung dabei unverändert lassen.
