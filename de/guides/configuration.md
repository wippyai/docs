# Konfigurationsreferenz

Wippy wird über `.wippy.yaml`-Dateien konfiguriert. Alle Optionen haben sinnvolle Standardwerte.

## Logger

Steuert den zap-Logger-Encoder. CLI-Flags (`-v`, `-c`, `-s`) überschreiben Level/Ausgabe; die einzige yaml-gesteuerte Option ist die Kodierung.

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `encoding` | string | console | Encoder: `console` (menschenlesbar) oder `json` (strukturiert) |

```yaml
logger:
  encoding: json
```

## Log-Manager

Steuert das Runtime-Log-Routing. Konsolenausgabe wird über [CLI-Flags](guides/cli.md) (`-v`, `-c`, `-s`) konfiguriert.

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `propagate_downstream` | bool | true | Logs an Konsolen-/Dateiausgabe senden |
| `stream_to_events` | bool | false | Logs für programmatischen Zugriff zum Event-Bus veröffentlichen |
| `min_level` | int | -1 | Minimales Level: -1=debug, 0=info, 1=warn, 2=error |

```yaml
logmanager:
  propagate_downstream: true
  stream_to_events: false
  min_level: 0
```

Siehe: [Logger-Modul](lua/system/logger.md)

## Profiler

Go pprof HTTP-Server für CPU-/Speicher-Profiling. Mit `-p` Flag oder Konfiguration aktivieren.

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `enabled` | bool | false | Profiler-Server starten |
| `address` | string | localhost:6060 | Adresse zum Lauschen |
| `read_timeout` | duration | 15s | HTTP Read-Timeout |
| `write_timeout` | duration | 15s | HTTP Write-Timeout |
| `idle_timeout` | duration | 60s | Keep-Alive-Timeout |

```yaml
profiler:
  enabled: true
  address: "localhost:6060"
```

Zugriff unter `http://localhost:6060/debug/pprof/`

## Sicherheit

Globales Sicherheitsverhalten. Individuelle Richtlinien werden als [security.policy-Einträge](guides/entry-kinds.md) definiert.

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `strict_mode` | bool | false | Zugriff verweigern wenn Sicherheitskontext unvollständig |

```yaml
security:
  strict_mode: true
```

Siehe: [Sicherheitssystem](system/security.md), [Sicherheitsmodul](lua/security/security.md)

## Registry

Eintragsspeicherung und Versionshistorie. Die Registry enthält alle Konfigurationseinträge.

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `enable_history` | bool | true | Eintragsversionen verfolgen |
| `history_type` | string | memory | Speicher: memory, sqlite, nil |
| `history_path` | string | .wippy/registry.db | SQLite-Dateipfad |

```yaml
registry:
  history_type: sqlite
  history_path: /var/lib/wippy/registry.db
```

Siehe: [Registry-Konzept](concepts/registry.md), [Registry-Modul](lua/core/registry.md)

## Relay

Nachrichtenrouting zwischen Prozessen über Knoten hinweg.

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `node_name` | string | local | Bezeichner für diesen Relay-Knoten |

```yaml
relay:
  node_name: worker-1
```

Siehe: [Prozessmodell](concepts/process-model.md)

## Supervisor

Dienst-Lebenszyklus-Verwaltung. Steuert das interne Steuerungs-Postfach des Supervisors, das zum Versand von Lebenszyklus-Ereignissen verwendet wird.

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `host.buffer_size` | int | 1024 | Kapazität des internen Steuerungs-Postfachs |
| `host.worker_count` | int | 16 | Nebenläufige Dispatcher-Worker |

```yaml
supervisor:
  host:
    buffer_size: 2048
    worker_count: 32
```

Siehe: [Supervision-Anleitung](guides/supervision.md)

<note>
Worker und Warteschlangen pro `process.host` werden am Eintrag selbst konfiguriert (`workers`, `queue_size`, `local_queue_size`), nicht in diesem globalen Abschnitt. Siehe den [Process Host](system/process-host.md)-Eintragstyp.
</note>

## Lua-Runtime

Lua-VM-Caching und Expression-Auswertung.

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `proto_cache_size` | int | 60000 | Kompilierter Prototype-Cache |
| `main_cache_size` | int | 10000 | Main-Chunk-Cache |
| `cache.enabled` | bool | false | Kompilierten Bytecode-/Typecheck-Cache auf Disk persistieren |
| `cache.dir` | string | (System-Cache-Verzeichnis) | Cache-Verzeichnis-Pfad |
| `cache.mode` | string | `read_write` | Cache-Modus: `read_write`, `read_only`, `write_only` |
| `type_system.enabled` | bool | false | Statische Typprüfung aktivieren |
| `type_system.strict` | bool | false | Typwarnungen als Fehler behandeln |

```yaml
lua:
  proto_cache_size: 60000
  cache:
    enabled: true
    dir: .cache/lua
  type_system:
    enabled: true
```

Siehe: [Lua-Übersicht](lua/overview.md)

## Finder

Registry-Such-Caching. Wird intern für Eintrags-Lookups verwendet.

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `query_cache_size` | int | 1000 | Gecachte Abfrageergebnisse |
| `regex_cache_size` | int | 100 | Kompilierte Regex-Muster |

```yaml
finder:
  query_cache_size: 2000
```

## OpenTelemetry

Verteiltes Tracing und Metrik-Export über OTLP.

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `enabled` | bool | false | OTEL aktivieren |
| `endpoint` | string | localhost:4318 | OTLP-Endpunkt |
| `protocol` | string | http/protobuf | Protokoll: grpc, http/protobuf |
| `service_name` | string | wippy-runtime | Dienst-Bezeichner |
| `service_version` | string | | Dienst-Versions-Tag |
| `insecure` | bool | true | Unverschlüsselte OTLP-Verbindung zulassen |
| `sample_rate` | float | 1.0 | Trace-Sampling (0.0-1.0) |
| `propagators` | string[] | `[tracecontext, baggage]` | Context-Propagatoren |
| `traces_enabled` | bool | true | Traces exportieren |
| `metrics_enabled` | bool | false | Metriken exportieren |
| `http.enabled` | bool | true | HTTP-Anfragen tracen |
| `http.extract_headers` | bool | true | Trace-Context aus eingehenden Headern extrahieren |
| `http.inject_headers` | bool | true | Trace-Context in ausgehende Header einfügen |
| `process.enabled` | bool | true | Prozess-Lebenszyklus tracen |
| `process.trace_lifecycle` | bool | true | Spans für spawn/terminate ausgeben |
| `interceptor.enabled` | bool | true | Funktionsaufrufe tracen |
| `interceptor.order` | int | 100 | Interceptor-Priorität |
| `queue.enabled` | bool | true | Queue publish/consume tracen |
| `temporal.enabled` | bool | false | Temporal-Workflows tracen |

```yaml
otel:
  enabled: true
  endpoint: "http://jaeger:4318"
  traces_enabled: true
  process:
    trace_lifecycle: true
```

Standard-OTEL-Umgebungsvariablen (`OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME`, `OTEL_TRACES_SAMPLER_ARG`, `OTEL_PROPAGATORS`, `OTEL_SDK_DISABLED`) überschreiben die entsprechenden Felder.

Siehe: [Observability-Anleitung](guides/observability.md)

## Shutdown

Verhalten beim kontrollierten Herunterfahren.

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `timeout` | duration | 30s | Maximale Wartezeit für Komponenten zum Stoppen |

```yaml
shutdown:
  timeout: 60s
```

## Metriken

Interner Metriken-Sammlungspuffer.

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `buffer.size` | int | 10000 | Metriken-Puffer-Kapazität |
| `interceptor.enabled` | bool | false | Funktionsaufrufe automatisch verfolgen |

```yaml
metrics:
  buffer:
    size: 20000
  interceptor:
    enabled: true
```

Siehe: [Metriken-Modul](lua/system/metrics.md), [Observability-Anleitung](guides/observability.md)

## Prometheus

Prometheus-Metriken-Endpunkt.

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `enabled` | bool | false | Metriken-Server starten |
| `address` | string | localhost:9090 | Adresse zum Lauschen |

```yaml
prometheus:
  enabled: true
  address: "0.0.0.0:9090"
```

Stellt `/metrics`-Endpunkt für Prometheus-Scraping bereit.

Siehe: [Observability-Anleitung](guides/observability.md)

## Cluster

Multi-Node-Clustering: Gossip-Mitgliedschaft plus ein begrenzter Raft-Konsenskern. Siehe den [Cluster-Leitfaden](guides/cluster.md) für Architektur und Betriebsmodell; dieser Abschnitt ist die Konfigurationsschlüssel-Referenz.

### Oberste Ebene

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `enabled` | bool | false | Clustering aktivieren |
| `name` | string | hostname | Knotenname; muss im Cluster eindeutig sein |
| `failure_domain` | string | | Zonen-/Rack-Label; im Gossip beworben, damit Voter über Domains verteilt werden |

### Mitgliedschaft (Gossip)

SWIM-Gossip über memberlist. Wird für Knotenentdeckung, Fehlererkennung und Metadaten-Verbreitung verwendet.

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `membership.bind_addr` | string | 0.0.0.0 | Gossip-Bind-Adresse |
| `membership.bind_port` | int | 7946 | Gossip-Bind-Port (TCP+UDP) |
| `membership.advertise_addr` | string | | Adresse, die Peers verwenden, um diesen Knoten zu erreichen (NAT/k8s) |
| `membership.join_addrs` | string | | Kommagetrennte Seed-`host:port`-Paare |
| `membership.secret_key` | string | | Base64-kodierter Gossip-Verschlüsselungsschlüssel (inline) |
| `membership.secret_file` | string | | Pfad zur Datei mit dem Gossip-Verschlüsselungsschlüssel |

### Internode (Transport)

TCP-Mesh für Relay- und Raft-Verkehr zwischen Knoten. Raft nutzt dieses Mesh (yamux-multiplexiert); es gibt keinen separaten Raft-Port.

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `internode.bind_addr` | string | 0.0.0.0 | Mesh-Bind-Adresse |
| `internode.bind_port` | int | 0 | Mesh-Port (0 = auto: 7950-7959, dann ephemer) |
| `internode.auto_port` | bool | true | Tatsächlichen Port beim Start ermitteln, festlegen und im Gossip bewerben |

### Raft (Konsens)

Begrenztes, festplatten-loses Raft. Zustand liegt im Speicher; beim Neustart tritt ein Knoten dem Quorum wieder bei und spielt von Peers ab. Kein `data_dir`. Bootstrap ist gossip-gesteuert (Consul/Nomad `bootstrap_expect`-Stil).

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `raft.enabled` | bool | true | Raft-Knoten betreiben; `false` macht diesen zum reinen Gossip-Client |
| `raft.role` | string | server | `server` betreibt einen Raft-Knoten; `client` ist nur Gossip |
| `raft.eligible` | bool | true | Ob dieser Knoten als Voter ausgewählt werden darf |
| `raft.priority` | int | 100 | Voter-Auswahlpriorität (niedrigerer Wert wird bevorzugt) |
| `raft.bootstrap_expect` | int | 1 | Initiale Quorumgröße: `0`=bestehendem beitreten, `1`=Einzelknoten, `N`=auf N berechtigte Peers warten, dann Quorum bilden |
| `raft.max_voters` | int | 5 | Voter-Obergrenze (muss ungerade sein); zusätzliche berechtigte Knoten werden Standbys |
| `raft.max_standbys` | int | 4 | Nicht-abstimmende Mitglieder, warm gehalten für Beförderung; Knoten jenseits voters+standbys sind keine Raft-Mitglieder |
| `raft.reconcile_debounce` | duration | 2s | Koaleszenzfenster nach einem Gossip-Ereignis, bevor der Voter-Reconciler läuft |
| `raft.reconcile_timeout` | duration | 2s | Schranke pro Reconcile-Durchlauf |
| `raft.heartbeat_timeout` | duration | 3s | Follower-Leerlaufwartzeit vor dem Start einer Wahl |
| `raft.election_timeout` | duration | 3s | Kandidaten-Wahltimeout (mindestens heartbeat) |
| `raft.commit_timeout` | duration | 500ms | Heartbeat-Takt des Leerlauf-Leaders |
| `raft.snapshot_threshold` | uint64 | 8192 | Log-Einträge seit dem letzten Snapshot, bevor ein neuer erstellt wird |
| `raft.snapshot_interval` | duration | 2m | Snapshot-Prüfintervall |
| `raft.snapshot_retain` | int | 3 | Beibehaltene Snapshots |
| `raft.trailing_logs` | uint64 | 10240 | Nach einem Snapshot beibehaltene Log-Einträge |
| `raft.max_append_entries` | int | 16 | Maximale Einträge pro AppendEntries RPC |
| `raft.leader_probe_interval` | duration | 3s | Takt der Globale-Registry-Leader-Erreichbarkeits-Probe |
| `raft.leader_probe_grace` | int | 3 | Aufeinanderfolgende Probe-Fehler, bevor Leader als nicht erreichbar gilt |

Einzelknoten (Entwicklung) — Clustering aktiviert, bootstrappt sich sofort:

```yaml
cluster:
  enabled: true
  name: dev
  raft:
    bootstrap_expect: 1
```

Drei-Knoten-Voting-Cluster — jeder Knoten listet die anderen als Seeds und wartet auf alle drei vor der Quorumbildung:

```yaml
cluster:
  enabled: true
  name: node-1
  failure_domain: us-east-1a
  membership:
    bind_port: 7946
    join_addrs: "node-2:7946,node-3:7946"
    secret_file: /etc/wippy/cluster.key
  raft:
    bootstrap_expect: 3
    max_voters: 5
```

Gossip-only-Client — tritt dem Cluster für Benennung/Messaging bei, betreibt nie Raft:

```yaml
cluster:
  enabled: true
  name: edge-7
  membership:
    join_addrs: "node-1:7946,node-2:7946"
  raft:
    role: client
```

## LSP

Language-Server-Protocol-Server für Editor-Integrationen.

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `enabled` | bool | false | TCP-Server aktivieren |
| `address` | string | :7777 | TCP-Listen-Adresse |
| `http_enabled` | bool | false | HTTP-Transport aktivieren |
| `http_address` | string | :7778 | HTTP-Listen-Adresse |
| `http_path` | string | /lsp | HTTP-Endpunkt-Pfad |
| `http_allow_origin` | string | * | CORS Allowed-Origin |
| `max_message_bytes` | int | 8388608 | Maximale Größe eingehender Nachrichten |

```yaml
lsp:
  enabled: true
  address: ":7777"
  http_enabled: true
```

Siehe: [LSP-Anleitung](guides/lsp.md)

## Netzwerkdienst

Overlay-Netzwerk-Manager (SOCKS5-, I2P-, Tailscale-Treiber).

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `state_dir` | string | .wippy/net | Verzeichnis für Treiber-Statusspeicherung |
| `default_network` | string | | Standard-Netzwerk-ID, die angewendet wird, wenn Einträge `network` weglassen |

```yaml
network_service:
  state_dir: /var/lib/wippy/net
  default_network: app:tailscale
```

Siehe: [Netzwerk-Overlays](system/network.md)

## HTTP-Dispatcher

Tuning für den gemeinsamen HTTP-Client-Pool, der von HTTP-dispatched Funktionen und ausgehenden Anfragen verwendet wird.

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `dispatcher.http.timeout` | duration | 0 (kein) | Timeout pro Anfrage |
| `dispatcher.http.max_idle_conns` | int | 0 (stdlib) | Maximale Leerlaufverbindungen über alle Hosts |
| `dispatcher.http.max_idle_per_host` | int | 0 (stdlib) | Maximale Leerlaufverbindungen pro Host |
| `dispatcher.http.idle_conn_timeout` | duration | 0 (stdlib) | Leerlaufverbindungs-Timeout |
| `dispatcher.http.max_clients` | int | 0 (unbegrenzt) | Maximale unterschiedliche gepoolte Clients |

```yaml
dispatcher:
  http:
    timeout: 30s
    max_idle_per_host: 32
```

## Module

Modul-Registry-Client, der von `wippy install`/`update` verwendet wird.

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `registry_url` | string | https://hub.wippy.ai | Registry-Endpunkt |

```yaml
modules:
  registry_url: https://internal-registry.example.com
```

## Erweiterungen

Native Go-Plugin-Erweiterungen, die beim Booten geladen werden (nur Unix).

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `enabled` | bool | true | Erweiterungen laden |
| `paths` | string[] | | Plugin-Dateipfade (relativ zum Konfigurationsverzeichnis) |

```yaml
extensions:
  enabled: true
  paths:
    - ./extensions/myplugin.so
```

## Umgebungsvariablen

| Variable | Beschreibung |
|----------|--------------|
| `GOMEMLIMIT` | Speicherlimit (überschreibt `--memory-limit` Flag) |

## Siehe auch

- [CLI-Referenz](guides/cli.md) - Kommandozeilenoptionen
- [Cluster-Leitfaden](guides/cluster.md) - Clustering-Architektur und Betrieb
- [Entry-Typen](guides/entry-kinds.md) - Alle Entry-Typen
- [Observability-Anleitung](guides/observability.md) - Logging, Metriken, Tracing
