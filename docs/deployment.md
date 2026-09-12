# Statisches Webdeployment

## Aktueller Testbetrieb

Die über Dokploy veröffentlichte Testinstanz läuft unter [https://aom.markus-kottlaender.de/](https://aom.markus-kottlaender.de/). Sie ist für den Projektinhaber und erste Playtester vorgesehen. Das ist keine Zusage zu Verfügbarkeit, Langzeitstabilität oder serverseitiger Spielstandsicherung; Profile bleiben an Browser und Origin gebunden.

## Anforderungen

Das Webdeployment benötigt nur Docker beziehungsweise eine Plattform mit Dockerfile-Build wie Dokploy. Es gibt kein Backend, keine Datenbank, keine persistenten Volumes und keine Laufzeitvariablen. Das Image baut die klassischen Laufzeitskripte reproduzierbar mit `npm ci` und `npm run build` und liefert anschließend ausschließlich folgende Dateien aus:

- `index.html`
- `styles/`
- erzeugtes `dist/src/`
- die 14 manuell gepflegten `preview-*.png`

Boden- und Skyboxtexturen sind in `dist/src/renderer/assets.js` eingebettet. Quellcode, Tests, Dokumentation, `node_modules`, Source Maps und die externen Texturquellen gelangen nicht ins Laufzeitimage.

## Dokploy

In Dokploy das Repository mit dem **Dockerfile** als Build-Typ konfigurieren. Der Container lauscht intern per HTTP auf **Port 8080**; Domain, öffentliches HTTPS und Zertifikate werden am Dokploy-Proxy eingerichtet. `GET /` eignet sich als Healthcheck und ist zusätzlich im Image als Docker-Healthcheck hinterlegt. Weitere Build- oder Startbefehle sind nicht nötig.

Die Auslieferung hat absichtlich keinen SPA-Routenfallback: Das Spiel verwendet keine clientseitigen URL-Routen, und fehlende Skripte oder Assets sollen mit 404 statt irreführend mit `index.html` antworten. HTML, CSS und JavaScript werden beim Build vorab gzip-komprimiert. Da ihre Namen noch keine Inhalts-Hashes tragen, verlangt Nginx Revalidierung und verhindert so gemischte Versionen nach einem Rollout.

Zum lokalen Prüfen:

```bash
docker build -t ashes-of-meridian .
docker run --rm -p 8080:8080 ashes-of-meridian
```

Danach `http://localhost:8080/` öffnen. Für ein öffentliches Deployment HTTPS verwenden und mindestens Start, lokale Assets, WebGL 2, Touchbedienung und Browserkonsole prüfen.

## Zustands- und Android-Grenzen

Aether, Upgrades, Fraktionsfreischaltungen und Einstellungen bleiben im `localStorage` des jeweiligen Browser-Origins. Ein Wechsel von Domain, Subdomain oder Protokoll erzeugt daher aus Browsersicht ein anderes Profil; es gibt keine serverseitige Synchronisierung. Gefechte bleiben wie bei `file://` ausschließlich flüchtig.

Dieses statische Webimage ist Test- und Browserauslieferung. Es ersetzt kein Android App Bundle und führt weder Capacitor noch AdMob ein; der spätere Play-Store-Weg bleibt separat in [Android, Google Play und Werbung](android.md) beschrieben.

[Architektur](architecture.md) · [Prüfverfahren](testing.md)
