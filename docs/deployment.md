# Auslieferung

Derselbe statische Browserstand funktioniert über `file://`, Webhosting und itch.io. Kein Backend/Volume für Offline-Spiel; Profile bleiben im Storage des jeweiligen Origins, ohne Synchronisierung. Domain-/Protokollwechsel erzeugt einen anderen Speicherraum.

## Docker und Dokploy

[Dockerfile](../Dockerfile) ist die maßgebliche Web-Laufzeitliste. Quellen, Tests und Source Maps bleiben draußen; lokale UI-Grafiken, Schriftdateien, CSS- und Audioassets zusätzlich zu eingebetteten WebGL-Assets mitführen. Bei neuen Laufzeitassets auch die Freigaben in [`.dockerignore`](../.dockerignore) ergänzen. [Nginx](../nginx.conf) liefert fehlende Dateien bewusst als 404, ohne SPA-Fallback; Revalidierung verhindert gemischte Versionen bei unhashed Dateinamen.

```bash
docker build -t ashes-of-meridian .
docker run --rm -p 8080:8080 ashes-of-meridian
```

Dokploy: Dockerfile-Build, Repository-Root als Kontext, kein Build-Target. HTTPS/TLS endet am Proxy; interne Appports nicht öffentlich öffnen.

| Dienst | Dockerfile | interner Port | Healthcheck | öffentlicher Endpunkt |
| --- | --- | --- | --- | --- |
| Spiel | `Dockerfile` | 8080 | `GET /` | `https://aom.markus-kottlaender.de` |
Das Singleplayer-Spiel benötigt keinen separaten Spielserver. Eine gegebenenfalls noch aktive frühere Multiplayerinstallation muss außerhalb des Quellcodeumbaus abgeschaltet werden; [offene Betriebsbereinigung](issues/multiplayer.md#betrieb-bereinigen).

## itch.io

Die englische Seitenbeschreibung wird in [`release/itch-description.md`](../release/itch-description.md) gepflegt und manuell auf itch.io übernommen.

`npm run build:zip` erzeugt `release/ashes-of-meridian-prototype.zip` mit `index.html` an der Wurzel. Als HTML-Build hochladen, „This file will be played in the browser“ aktivieren und Vollbild/responsiven Viewport ermöglichen. Neue lokale Assets in ZIP- und Docker-Paketweg gemeinsam berücksichtigen; für Sprache gilt der [Katalog-/Paketvertrag](audio.md). `node scripts/build-zip.mjs <ziel.zip>` erlaubt nach dem Build einen abweichenden Ausgabeweg, etwa für isolierte Paketprüfungen.

`npm run capture:itch` erzeugt Präsentationsmedien unter `release/itch-media/`; benötigt Chromium (`CHROMIUM_PATH` für abweichenden Pfad). Arrangierte Motive sind kein Spiel-/Balancingnachweis; nicht routinemäßig als Prüfung starten.

Nach tatsächlichem Paket-/Hostingwechsel gezielt Assets/404/MIME, Start und Audiofreigabe prüfen. [Prüfwahl](testing.md). Android bleibt eine [zurückgestellte Option](issues/android.md).
