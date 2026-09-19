# Statisches Webdeployment

Die [öffentliche Testversion](../README.md) wird über Dokploy ausgeliefert; zusätzlich kann derselbe statische Stand als HTML5-Prototyp bei itch.io veröffentlicht werden. Das statische Paket selbst benötigt kein Backend, keine Datenbank, persistenten Volumes oder Laufzeitvariablen. Der optionale [Multiplayerserver](../server/README.md#separat-deployen) wird als eigener Dienst deployt; er ist nicht Teil dieses Nginx-Images. Lokale `file://`-Auslieferung bleibt unabhängig davon unterstützt.

## Docker und Dokploy

Das [Dockerfile](../Dockerfile) baut mit `npm ci` und `npm run build` und stellt die benötigten Laufzeitdateien für Nginx zusammen. Es ist die maßgebliche Auslieferungsliste: HTML, Styles, gebaute Skripte sowie lokale Audio- und Portraitdateien. WebGL-Texturen sind bereits eingebettet; Quelltexturen, Tests, Dokumentation und Source Maps gehören nicht ins Laufzeitimage.

In Dokploy **Dockerfile** als Build-Typ und intern **HTTP-Port 8080** konfigurieren. Domain, öffentliches HTTPS und Zertifikate übernimmt der Proxy. `GET /` dient als Healthcheck, zusätzlich im Image hinterlegt. Keine weiteren Startbefehle nötig.

Die [Nginx-Konfiguration](../nginx.conf) verwendet absichtlich **keinen SPA-Fallback**: fehlende Skripte/Assets müssen 404 liefern, nicht HTML. Solange Dateinamen keine Inhalts-Hashes tragen, verhindert Revalidierung gemischte Versionen nach Rollouts. HTML/CSS/JavaScript werden beim Build vorab gzip-komprimiert.

Lokal starten:

```bash
docker build -t ashes-of-meridian .
docker run --rm -p 8080:8080 ashes-of-meridian
```

Dann `http://localhost:8080/` öffnen. Bei Containeränderungen gezielt Imagebau, Healthcheck, MIME-Typen, 404-Verhalten und erforderliche Laufzeitassets prüfen; weitere Browserprüfungen nach [Risiko](testing.md). Öffentlich HTTPS verwenden.

## Multiplayerserver in Dokploy

Spiel und Server sind zwei Anwendungen aus demselben Commit. Für den Server muss Dokploy den **Repository-Root als Build-Kontext** verwenden; `server/` allein kann die gemeinsamen Simulationsquellen nicht sehen:

| Einstellung | Hauptspiel | Multiplayerserver |
| --- | --- | --- |
| Dockerfile | `Dockerfile` | `server/Dockerfile` |
| Build-Kontext | Repository-Root (`.` bzw. `/`) | Repository-Root (`.` bzw. `/`) |
| interner HTTP-Port | `8080` | `8787` |
| öffentlicher Endpunkt | `https://aom.markus-kottlaender.de` | `wss://aoms.markus-kottlaender.de` |
| Healthcheck | `GET /` | `GET /health` |

Kein Build-Target angeben; beide Dockerfiles wählen ihre letzte Runtime-Stage selbst. Traefik spricht intern unverschlüsseltes HTTP mit dem Container, TLS/WSS endet am Proxy. Ein normaler Browseraufruf von `/` am Multiplayerserver ist kein Website-Test: `/` ist der WebSocket-Endpunkt und liefert ohne Upgrade 404; `/health` muss `200` mit Protokollversion liefern.

Der Server benötigt keine Volumes oder Datenbank. Deployments und Containerneustarts beenden laufende Sessions absichtlich. Maßgebliche Variablen:

```env
ALLOWED_ORIGINS=https://aom.markus-kottlaender.de,https://html-classic.itch.zone
# optional nur weiter reduzieren; die absolute Codegrenze bleibt zwei Räume
MAX_ROOMS=2
```

Die itch.io-Origin am tatsächlichen WebSocket-Request prüfen; die Projektseite ist nicht zwingend die Origin des eingebetteten HTML5-Builds. `null` nur ergänzen, wenn direkte `file://`-Clients den öffentlichen Server verwenden sollen. Eine geteilte Hosting-Origin ist keine Authentifizierung.

### Dokploy-/Traefik-Diagnose

Die Remote-App-VM nimmt 80/443 über `dokploy-traefik` an; Appports bleiben intern. Bei Fehlern in dieser Reihenfolge unterscheiden:

1. DNS und öffentliche Ports (`curl -I https://…`) – Verbindungsablehnung liegt vor der Anwendung.
2. Container/Service gesund und Domain auf den richtigen internen Port geroutet.
3. Traefik und Service gemeinsam im Overlay-Netz `dokploy-network`; ein 502 bei gesundem Container ist häufig fehlende Backend-Erreichbarkeit.
4. Backend aus Traefik per Servicename und internem Port prüfen, danach `/health` öffentlich.

Bei Dokploy v0.30.6 wurde folgende Teilinstallation beobachtet: Belegte Ports 80/443 ließen `docker run` nach dem Anlegen des Traefik-Containers scheitern. Wegen `set -e` wurde das nachfolgende `docker network connect dokploy-network dokploy-traefik` nicht ausgeführt; ein erneutes Setup erkannte nur den vorhandenen Container, und **Reload** führte lediglich `docker restart` aus. Nach Prüfung mit `docker inspect` reparierte einmalig:

```bash
docker network connect dokploy-network dokploy-traefik
```

Das ist eine gezielte Reparatur für genau diesen nachgewiesenen Zustand, kein routinemäßiger Deploymentschritt. Vorher Portbelegung, Containerstatus und Netzwerke prüfen; keinen zusätzlichen Nginx installieren und 8080/8787 nicht öffentlich öffnen.

## itch.io

```bash
npm run build:zip
```

Der Befehl baut neu und erzeugt `release/ashes-of-meridian-prototype.zip`. Das Archiv enthält `index.html` direkt an seiner Wurzel sowie nur die benötigten Styles, kompilierten Skripte, Audio- und Portraitdateien. Source Maps, TypeScript-Quellen, Tests, Dokumentation und Quelltexturen bleiben draußen. Der Paketinhalt ist sortiert und mit festen Zeitstempeln reproduzierbar.

Das ZIP auf der itch.io-Projektseite als **HTML**-Build hochladen und **„This file will be played in the browser“** aktivieren. Wegen WebGL 2 und des bildschirmfüllenden Touch-Layouts den eingebetteten Viewport auf automatisch bzw. Vollbild konfigurierbar stellen; eine feste kleine Canvas-Größe vermeiden. Nach dem Upload mindestens Startmenü, Audiofreigabe, Gefechtsstart und Browserkonsole am tatsächlich von itch.io ausgelieferten Build prüfen.

Die Laufzeitdateiliste entspricht dem Docker-Webdeployment. Bei neuen lokalen Assets beide Paketwege gemeinsam aktualisieren und jeweils auf fehlende Dateien prüfen.

`npm run capture:itch` erzeugt unter `release/itch-media/` aktuelle, arrangierte Desktop-Präsentationsmotive, separate Portrait-Screenshots mit vollständigem Mobile-HUD sowie Banner, Full-HD+-Seitenhintergrund, Embed-Hintergrund und eine Textdatei mit Theme-Farben und Uploadeinstellungen. Dafür muss Chromium installiert sein; einen abweichenden Pfad über `CHROMIUM_PATH` angeben. Die Aufnahmen sind technische, bevölkerte Präsentationsfixtures und kein Spielstands- oder Balancingnachweis.

## Zustandsgrenzen

Profile liegen im `localStorage` des jeweiligen Browser-Origins. Domain-/Protokollwechsel erzeugt aus Browsersicht ein anderes Profil; es gibt keine serverseitige Sicherung oder Synchronisierung. Das Hosting macht flüchtige Runs nicht wiederherstellbar.

Das Image ist keine Android-App. Eine mögliche Hülle mit Werbung bleibt eine [zurückgestellte Option](issues/android.md), kein Auslieferungsvertrag.
