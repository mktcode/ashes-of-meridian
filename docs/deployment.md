# Veröffentlichung

Statischer Singleplayer-Stand, kein Backend oder Volume. Profile gehören zum jeweiligen
Browser-Origin; Domain-/Protokollwechsel bedeutet einen anderen Speicherraum, keine Synchronisierung.

## Docker und Dokploy

```bash
docker build -t ashes-of-meridian .
docker run --rm -p 8080:8080 ashes-of-meridian
```

[Dockerfile](../Dockerfile) und [`.dockerignore`](../.dockerignore) bestimmen Laufzeitdateien.
Neue Assets auch im ZIP berücksichtigen. [Nginx](../nginx.conf) liefert fehlende Dateien als
404 ohne SPA-Fallback; Revalidierung schützt unhashed Dateinamen vor gemischten Ständen.

Dokploy: Repository-Root als Kontext, Dockerfile ohne Build-Target, interner Port 8080,
Healthcheck `GET /`. TLS endet am Proxy; interne Ports nicht öffentlich öffnen.
Öffentlicher Endpunkt: `https://aom.markus-kottlaender.de/`.
Ein möglicherweise noch laufender alter Multiplayerdienst ist [offene Betriebsarbeit](issues/ideen.md#multiplayer).

## itch.io

`npm run build:zip` erzeugt `release/ashes-of-meridian-prototype.zip` mit `index.html`
an der Wurzel. Als HTML-Build hochladen, „This file will be played in the browser“
aktivieren und Vollbild/responsiven Viewport ermöglichen. Seitenbeschreibung manuell
auf itch.io pflegen; keine zweite Sollfassung im Repository.

`npm run capture:itch -- --help` zeigt Szenen/Optionen; `--scene <id>` begrenzt die Aufnahme.
Ausgaben sind neue eigene `.tmp/`-Ordner oder bewusst `release/itch-media/<neuer-lauf>`.
Medien manuell auswählen und veröffentlichen. Arrangierte Feuergefechte sind kein Balancenachweis.
[Browser-/Ausgabegrenzen](scene-capture.md).

Nach tatsächlichem Paket-/Hostingwechsel gezielt Assets, 404/MIME, Start und Audiofreigabe
prüfen; kein automatischer Push/Deployment. [Assetpflege](assets.md).
