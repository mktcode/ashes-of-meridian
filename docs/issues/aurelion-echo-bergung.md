# Aurelion: offene Spiel-, Modell- und Kartenabnahme

Teststart nach Build: `index.html?experiment=aurelion-playable` (Stage 4, drei Parteien, zwei Worker je Partei; flüchtiges Profil). [Bergungsregeln](../gameplay.md#echo-bergung-auf-aurelion) · [Missionsvertrag](../architecture.md#einzelspieler-missionen).

- [ ] Einführung, Kernauftrag, ungesicherte Fracht und gesicherte Punkte verständlich? Gemischte Auswahl, Abbruch/Wiederaufnahme und HQ-Wiederaufbau spielen.
- [ ] Wirtschaft/Bergung/Eskorte, Gegenverkehr und Angriffe auf Transportwege in echten FFA-Partien balancieren. Gleichzeitiges Zielerreichen/Eliminierung und Ergebnis/Reload abnehmen.
- [ ] Reaktorkern: Facetten, Einfassung und Details bei normalem Zoom lesbar, nicht von Licht überstrahlt? Geometrie bleibt innerhalb des gesperrten Sockels; Wege/Radien nicht nebenbei ändern.
- [ ] Stadtvarianten: Plattformkanten, Lampenmasken, Anzeigen, Unterdeckverkehr, Wolken und Nacht-/Dämmerungskontrast bei verschiedenen Höhen beurteilen. Unterdeckverkehr ist Dekor, keine Hindernisvermeidung für Spielflugzeuge.
- [ ] **Schwarze Rechteckfläche links oben:** pausierter Chromium-Check bei 1280×900, etwa 200×136 px unter der HUD-Leiste, bereits vor Missions-HUD. Ursache und Echtgeräteauftreten offen; keine GL-Fehler ist keine Darstellungsbestätigung.
- [ ] Eingabelatenz, Weltwechsel-/GPU-Kosten auf Zielgeräten messen. Hohe Stadtgeometrie und fehlender Flugschutz gegen hohe Dekorbauten bleiben Grenzen.

Keine Multiplayerfreigabe oder weitere Mission aus dieser Abnahme ableiten. Gemeinsame [Geräteprüfung](playtest-validation.md), [Performance](mobile-performance.md).
