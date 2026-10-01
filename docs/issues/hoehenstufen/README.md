# Höhen: verbleibende Spielabnahme

Gemeinsame CPU-Oberfläche und diskrete Sichtstufen sind integriert; [Vertrag](../../architecture.md#welt-darstellung-und-zufall), [Spielregeln](../../gameplay.md). Keine zusätzliche SC2-Regel oder allgemeine Gelände-Sichtlinie.

Teststart nach Build: `index.html?experiment=height` (Mothership, Seed 1409, zwei Worker, flüchtiges Profil).

- [ ] Hohe Basen, Rampen und tiefes Zentrum bei normalem Zoom erkennen; Verdeckung insbesondere an vorderen Plateaurändern prüfen.
- [ ] Worker/Gruppen hinunter und hinauf schicken: Picking, Minimap, Hanglage, Rampen-Gegenverkehr und Produktionsausgänge.
- [ ] Abbau/Rücktransport, Raffinerien und ebene Fundamente auf beiden Ebenen; keine Arbeit durch Klippen oder Bau auf Rampen.
- [ ] Sicht von unten/oben, Rampenmitte, Quellenvereinigung/-verlust und Flugzeug/Scan prüfen; keine Schaden-/Reichweitenboni.
- [ ] Zwei-Client-Sicht/Effekte und interpolierte Bodenposen mit passendem Serverstand prüfen; Touch/Mobilkosten und vollständige Partien abnehmen.
- [ ] Faire Wege/Ressourcenzugänge aller vier öffentlichen Starts; Walling darf nicht unbeabsichtigt jeden Ausgang schließen. Gewünschte absichtliche Walling-Regel bleibt offen.

Naturkarten besitzen eigenes Relief, nicht automatisch Motherships Plateau-Grundriss. Einheitliche erhöhte Randbasen auf Alien/Desert bleiben eine eigene Layoutentscheidung; keine Fortsetzung alter Planpakete. [Landschaftsabnahme](../project-tomorrow.md), [Mothership-Gestaltung](../terrain.md), [Worker-Grenzen](../worker-bauwegfindung/issue.md). Flugfreiraum separat unter [Landschaften](../project-tomorrow.md#flugfreiraum-nach-dem-reliefausbau).
