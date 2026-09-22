# Karten-Vorschaubilder im ZIP-Paket

Beim Prüfen der Westmark-Auslieferung fiel im bestehenden Paketvertrag auf: `styles/screens.css` referenziert für die Ergebnis-/Folgekartenvorschau von Desert, Alien Planet und Mothership Bilder unter `assets/textures/`. `scripts/build-zip.mjs` nimmt jedoch nur Portraits als lose Bildassets mit und prüft Referenzen ausschließlich aus `index.html`. Die eingebetteten WebGL-Texturen ersetzen diese CSS-URLs nicht. Westmark verwendet vorläufig einen CSS-Verlauf und führt keine zusätzliche Bildabhängigkeit ein.

- [ ] Betroffene CSS-Bilder in den Paketumfang aufnehmen oder die Vorschau ausdrücklich anders ausliefern; CSS-Referenzen in die Paketprüfung einbeziehen.
- [ ] Die drei Ergebnisvorschauen anschließend aus einem entpackten Release prüfen. Befund bislang statisch aus CSS und Paketmanifest, kein Browsernachweis des ZIP-Pakets.

Kein Anlass, kanonische Texturen zu löschen oder gemeinsame Materialien auszutauschen. [Auslieferung](../deployment.md), [Bildpflege](../rendering.md#texturen-und-portraits).
