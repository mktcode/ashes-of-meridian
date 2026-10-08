# Höhen: verbleibende Spielabnahme

Gemeinsame CPU-Oberfläche und diskrete Sichtstufen sind integriert; [Vertrag](../../architecture.md#welt-darstellung-und-zufall), [Spielregeln](../../gameplay.md). Keine zusätzliche SC2-Regel oder allgemeine Gelände-Sichtlinie.

Teststart nach Build: `index.html?experiment=height` (Mothership, Seed 1409, zwei Worker, flüchtiges Profil).

- [ ] Höhen, begehbare Verbindungen und Klippen der prozeduralen Landschaft bei normalem Zoom erkennen; keine vier hohen Basen oder festes tiefes Zentrum voraussetzen.
- [ ] Worker/Gruppen hinunter und hinauf schicken: Picking, Minimap, Hanglage, Rampen-Gegenverkehr und Produktionsausgänge.
- [ ] Abbau/Rücktransport, Raffinerien und stabile Fundamente einschließlich sanfter Hänge; keine Arbeit durch Klippen oder Bau auf steilen Übergängen.
- [ ] Lokale Gebäude-Bodenhaut, dezente Hangneigung und Menü-Bauplätze visuell abnehmen: keine erkennbaren Fremdtextur-Platten, glaubwürdiger Terrainanschluss, erhaltene Menükomposition. Gezielte CPU-Prüfungen sichern Stützebene, Materialgewichte, weichen Auslauf und Patch-Lebenszyklus; gezielte `file://`-Browserchecks bestätigen Upload-/Shaderpfad und Freigabe entfernter Patches, nicht die visuelle Gesamt- oder Echtgeräteabnahme. Grenzen der rein visuellen Auffüllung: [Darstellungsvertrag](../../rendering.md#einzeln-wartbare-modelle).
- [ ] Sicht von unten/oben, Rampenmitte, Quellenvereinigung/-verlust und Flugzeug/Scan prüfen; keine Schaden-/Reichweitenboni.
- [ ] Lokale Sicht/Effekte und Bodenposen, Touchbedienung und vollständige Singleplayer-Partien abnehmen; Mobilkosten zentral unter [Performance](../performance/README.md#mobilstabilität-und-speicher).
- [ ] Faire Wege/Ressourcenzugänge der getrennt zugeteilten Parteienstarts; Walling darf nicht unbeabsichtigt jeden Ausgang schließen. Gewünschte absichtliche Walling-Regel bleibt offen.

Alle Familien verwenden seedbasierte Höhen; der alte Mothership-Plateaugrundriss ist keine Vorgabe. [Landschaftsabnahme](../project-tomorrow.md), [Mothership-Gestaltung](../project-tomorrow.md#mothership-prozedurale-industrieflächen), [Worker-Grenzen](../worker-bauwegfindung/issue.md). Flugfreiraum separat unter [Landschaften](../project-tomorrow.md#flugfreiraum-nach-dem-reliefausbau).
