---
title: "Cloud-Speicher"
description: "<secondary-label ref='external'/"
---

# Cloud-Speicher
<secondary-label ref="external"/>

S3-kompatibler Objektspeicher mit vorsignierten URLs, Multipart-Uploads und Bereichs-Lesevorgängen.

## Entry-Typen

| Kind | Beschreibung |
|------|--------------|
| `config.aws` | AWS-Anmeldedaten und Regionskonfiguration |
| `cloudstorage.s3` | S3-Bucket-Verbindung |

## AWS-Konfiguration

```yaml
- name: aws_config
  kind: config.aws
  region: "us-east-1"
  access_key_id_env: "AWS_ACCESS_KEY_ID"
  secret_access_key_env: "AWS_SECRET_ACCESS_KEY"
```

| Feld | Typ | Erforderlich | Beschreibung |
|------|-----|--------------|--------------|
| `region` | string | Bedingt | AWS-Region. Erforderlich, sofern `region_env` nicht gesetzt ist |
| `region_env` | string | Bedingt | Name der Umgebungsvariable, die die Region enthält |
| `access_key_id_env` | string | Nein | Umgebungsvariablenname für Access Key |
| `secret_access_key_env` | string | Nein | Umgebungsvariablenname für Secret Key |

Anmeldedaten werden aus den angegebenen Umgebungsvariablen geladen. Sowohl `access_key_id_env` als auch `secret_access_key_env` müssen sich zu nicht-leeren Werten auflösen, damit statische Anmeldedaten greifen; andernfalls wird die AWS SDK Standard-Anmeldekette verwendet (IAM-Rollen, Instanzprofile, etc.).

Requests werden vom AWS SDK mit AWS Signature Version 4 unter Verwendung der aufgelösten Anmeldedaten signiert. Es ist keine Signierungskonfiguration erforderlich.

<note>
Verwenden Sie die <code>_env</code>-Varianten (<code>region_env</code> sowie <code>bucket_env</code>/<code>endpoint_env</code> unten), wenn ein Wert je Deployment unterschiedlich ist. Der Variablenname wird beim Start aus der Umgebungs-Registry aufgelöst.
</note>

<note>
AWS-Konfiguration ist geplant, in zukünftigen Releases mit anderen AWS-Diensten (SQS, etc.) geteilt zu werden.
</note>

## S3-Speicher

```yaml
- name: files
  kind: cloudstorage.s3
  bucket: "my-bucket"
  config: app.infra:aws_config
```

| Feld | Typ | Erforderlich | Beschreibung |
|------|-----|--------------|--------------|
| `bucket` | string | Bedingt | S3-Bucket-Name. Erforderlich, sofern `bucket_env` nicht gesetzt ist |
| `bucket_env` | string | Bedingt | Name der Umgebungsvariable, die den Bucket-Namen enthält |
| `config` | reference | Ja | AWS-Konfigurations-Entry-Referenz |
| `endpoint` | string | Nein | Benutzerdefinierter Endpunkt für S3-kompatible Dienste |
| `endpoint_env` | string | Nein | Name der Umgebungsvariable, die den benutzerdefinierten Endpunkt enthält |

### S3-kompatible Dienste

Für MinIO oder andere S3-kompatible Dienste setzen Sie einen benutzerdefinierten Endpunkt:

```yaml
- name: local_storage
  kind: cloudstorage.s3
  bucket: "local-bucket"
  config: app.infra:aws_config
  endpoint: "http://localhost:9000"
```

Wenn ein Endpunkt angegeben wird, wird Pfadstil-Zugriff automatisch aktiviert.

## Multipart-Uploads

Vorsignierte Multipart-Uploads sind eine Fähigkeit des Providers, kein Feature der Runtime. Der `cloudstorage.s3`-Typ implementiert sie; ein Provider, der das Multipart-Protokoll nicht unterstützt, lässt `create_multipart_upload`, `presigned_part_urls`, `complete_multipart_upload` und `abort_multipart_upload` mit `errors.UNAVAILABLE` fehlschlagen.

Teile eines Uploads, der nie abgeschlossen oder abgebrochen wird, bleiben gespeichert und werden berechnet. Anwendungen brechen auf jedem Fehlerpfad ab, aber bei einem abgestürzten Client läuft nichts mehr, was diesen Abbruch ausführen könnte. Als Absicherung eine `AbortIncompleteMultipartUpload`-Lifecycle-Regel auf dem Bucket konfigurieren:

```json
{
  "Rules": [
    {
      "ID": "abort-incomplete-multipart",
      "Status": "Enabled",
      "Filter": { "Prefix": "" },
      "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 7 }
    }
  ]
}
```

## Bereichs-Lesevorgänge

`open_reader` liest ein Objekt über Ranged-GETs und fixiert das ETag des Objekts bei jedem Lesevorgang mit `If-Match`. Ein Provider, der beim initialen Stat kein ETag zurückgibt, lässt den Aufruf mit `errors.UNAVAILABLE` fehlschlagen, und ein Provider, der `If-Match` ignoriert, verliert den Überschreibschutz - der Lesevorgang kann dann nicht erkennen, dass er zwei Objektgenerationen vermischt hat.

## Lua-API

Siehe [Cloud-Storage-Modul](lua/storage/cloud.md) für Operationen (list, upload, download, delete, vorsignierte URLs, Multipart-Uploads, Bereichs-Reader).

## Siehe auch

- [Cloud-Storage-Modul](lua/storage/cloud.md) - Lua-API-Referenz
- [Dateisystem](system/filesystem.md) - Lokale Dateisystem-Einträge
- [Queue](system/queue.md) - Der SQS-Handler nutzt dieselben `config.aws`-Einträge
