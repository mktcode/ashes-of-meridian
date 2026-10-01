# Auslieferung

Derselbe statische Browserstand funktioniert über `file://`, Webhosting und itch.io. Kein Backend/Volume für Offline-Spiel; Profile bleiben im Storage des jeweiligen Origins, ohne Synchronisierung. Domain-/Protokollwechsel erzeugt einen anderen Speicherraum.

## Docker und Dokploy

[Dockerfile](../Dockerfile) ist die maßgebliche Web-Laufzeitliste. Quellen, Tests und Source Maps bleiben draußen; lokale CSS-/Audioassets zusätzlich zu eingebetteten WebGL-Assets mitführen. [Nginx](../nginx.conf) liefert fehlende Dateien bewusst als 404, ohne SPA-Fallback; Revalidierung verhindert gemischte Versionen bei unhashed Dateinamen.

```bash
docker build -t ashes-of-meridian .
docker run --rm -p 8080:8080 ashes-of-meridian
```

Dokploy: Dockerfile-Build, Repository-Root als Kontext, kein Build-Target. HTTPS/TLS endet am Proxy; interne Appports nicht öffentlich öffnen.

| Dienst | Dockerfile | interner Port | Healthcheck | öffentlicher Endpunkt |
| --- | --- | --- | --- | --- |
| Spiel | `Dockerfile` | 8080 | `GET /` | `https://aom.markus-kottlaender.de` |
| Multiplayer | `server/Dockerfile` | 8787 | `GET /health` | `wss://aoms.markus-kottlaender.de` |

Server separat aus demselben Commit bauen/ausrollen; `server/` allein ist kein ausreichender Build-Kontext. `/` am Server ist der WebSocket-Endpunkt und ohne Upgrade keine Website. Konfiguration und flüchtige Sessiongrenzen: [Serverbetrieb](../server/README.md#separat-deployen).

Bei 502 trotz gesundem Container Domain/Port und gemeinsame Erreichbarkeit im `dokploy-network` prüfen. DNS/öffentliche Verbindung zuerst, dann Backend aus Traefik erreichen. Keine pauschalen Netzwerkreparaturen ohne Zustandsprüfung.

## itch.io

`npm run build:zip` erzeugt `release/ashes-of-meridian-prototype.zip` mit `index.html` an der Wurzel. Als HTML-Build hochladen, „This file will be played in the browser“ aktivieren und Vollbild/responsiven Viewport ermöglichen. Neue lokale Assets in ZIP- und Docker-Paketweg gemeinsam berücksichtigen.

`npm run capture:itch` erzeugt Präsentationsmedien unter `release/itch-media/`; benötigt Chromium (`CHROMIUM_PATH` für abweichenden Pfad). Arrangierte Motive sind kein Spiel-/Balancingnachweis; nicht routinemäßig als Prüfung starten.

Nach tatsächlichem Paket-/Hostingwechsel gezielt Assets/404/MIME, Start und Audiofreigabe prüfen. WebSocket-Origin des eingebetteten itch.io-Builds prüfen, nicht aus der Projektseiten-URL ableiten. [Prüfwahl](testing.md). Android bleibt eine [zurückgestellte Option](issues/android.md).
