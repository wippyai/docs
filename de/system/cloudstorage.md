---
title: "Cloud-Speicher"
description: "Konfigurieren Sie AWS-Zugangsdaten und S3-kompatiblen Objektspeicher."
---

# Cloud-Speicher
<secondary-label ref="external"/>

Cloud-Storage-Einträge konfigurieren AWS-Zugangsdaten und S3-kompatible Buckets für die Lua-Storage-API. Diese Seite ist eine Konfigurationsreferenz; die Ausschnitte setzen voraus, dass der benannte Bucket und die Zugangsdaten beziehungsweise die SDK-Zugangsdatenkette bereits vorhanden sind.

## Entry-Typen

| Art | Beschreibung |
|------|--------------|
| `config.aws` | AWS-Anmeldedaten und Regionskonfiguration |
| `cloudstorage.s3` | S3-Bucket-Verbindung |

## AWS-Konfiguration

Statische, über das Umgebungssystem registrierte Zugangsdaten:

```yaml
- name: aws_config
  kind: config.aws
  region: ${env:AWS_REGION}
  access_key_id: ${env:AWS_ACCESS_KEY_ID}
  secret_access_key: ${env:AWS_SECRET_ACCESS_KEY}
```

Standardmäßige AWS-SDK-Zugangsdatenkette, etwa für IAM-Rollen oder Instanzprofile:

```yaml
- name: aws_config
  kind: config.aws
  region: ${env:AWS_REGION}
```

| Feld | Typ | Erforderlich | Beschreibung |
|------|-----|--------------|--------------|
| `region` | string | Ja | AWS-Region. Verwenden Sie `${env:NAME}`, wenn sie je Deployment variiert |
| `access_key_id` | string | Nein | AWS-Access-Key-ID, inline oder als `${env:NAME}` |
| `secret_access_key` | string | Nein | Geheimer AWS-Zugriffsschlüssel, inline oder als `${env:NAME}` |

Zugangsdatenfelder werden beim Dekodieren aus der [Umgebungs-Registry](./env.md) aufgelöst. Ein moderner `${env:NAME}`-Platzhalter ohne Standardwert lässt die Dekodierung bei einer fehlenden Variable fehlschlagen. Lassen Sie daher `access_key_id` und `secret_access_key` weg, um die standardmäßige AWS-SDK-Zugangsdatenkette zu verwenden. Statische Zugangsdaten werden nur angewendet, wenn beide Felder nicht leere Werte ergeben.

Anfragen werden vom AWS SDK mit AWS Signature Version 4 unter Verwendung der aufgelösten Anmeldedaten signiert. Es ist keine Signierungskonfiguration erforderlich.

<note>
Ältere Konfigurationen verwenden eine benachbarte <code>&lt;field&gt;_env</code>-Direktive (<code>region_env</code>, <code>access_key_id_env</code>, <code>secret_access_key_env</code>), die ebenfalls in der Umgebungs-Registry nachschlägt. Anders als ein moderner Platzhalter ohne Standardwert behält eine nicht registrierte oder leere Legacy-Auflösung den Inline- oder Nullwert bei. Die Legacy-Form ist <b>veraltet</b> — migrieren Sie sie bewusst und ergänzen Sie Platzhalter-Standardwerte, wenn ein gleichwertiges Fallback-Verhalten erforderlich ist.
</note>

<note>
Ein einzelner <code>config.aws</code>-Eintrag kann von mehreren AWS-basierten Diensten wiederverwendet werden. <code>queue.driver.sqs</code> referenziert denselben Eintrag über sein Feld <code>config:</code>.
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
| `bucket` | string | Ja | S3-Bucket-Name. Verwenden Sie `${env:NAME}`, wenn er je Deployment variiert |
| `config` | reference | Ja | AWS-Konfigurations-Entry-Referenz |
| `endpoint` | string | Nein | Benutzerdefinierter Endpunkt für S3-kompatible Dienste, inline oder als `${env:NAME}` |

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

## Lua-API

Siehe [Cloud-Storage-Modul](../lua/storage/cloud.md) für Operationen (list, upload, download, delete, vorsignierte URLs).

## Siehe auch

- [Cloud-Storage-Modul](../lua/storage/cloud.md) - Lua-API-Referenz
- [Dateisystem](./filesystem.md) - Lokale Dateisystem-Einträge
- [Queue](./queue.md) - Der SQS-Handler nutzt dieselben `config.aws`-Einträge
