# Cloud-Speicher
<secondary-label ref="external"/>

S3-kompatibler Objektspeicher mit vorsignierten URLs.

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
| `region` | string | Ja | AWS-Region |
| `access_key_id_env` | string | Nein | Umgebungsvariablenname für Access Key |
| `secret_access_key_env` | string | Nein | Umgebungsvariablenname für Secret Key |

Anmeldedaten werden aus den angegebenen Umgebungsvariablen geladen. Falls weggelassen, wird auf die AWS SDK Standard-Anmeldekette zurückgefallen (IAM-Rollen, Instanzprofile, etc.).

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
| `bucket` | string | Ja | S3-Bucket-Name |
| `config` | reference | Ja | AWS-Konfigurations-Entry-Referenz |
| `endpoint` | string | Nein | Benutzerdefinierter Endpunkt für S3-kompatible Dienste |

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

Siehe [Cloud-Storage-Modul](lua/storage/cloud.md) für Operationen (list, upload, download, delete, vorsignierte URLs).
