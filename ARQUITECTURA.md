# VERTIA CORE — Arquitectura de Escalabilidad

## Cómo agregar un nuevo sitio cliente

El sistema es 100% data-driven. Para incorporar un nuevo cliente basta con:

### 1. Agregar el sitio en la fuente de datos

**Desarrollo / demo** — editar `src/lib/telemetry/mock-data.ts`:
```ts
{
  id: "site-nuevocliente",
  name: "Nueva Sucursal",
  shortName: "NSC",
  type: "branch",
  coords: { lat: -31.4167, lng: -64.1833 },   // Córdoba, por ejemplo
  status: "operational",
  resilienceScore: 95,
  connectedDevices: 20,
  activeUsers: 12,
  firewallEnabled: true,
  links: [
    { id: "link-nsc-fiber", type: "fiber", provider: "Telecom", status: "active",
      latencyMs: 6, bandwidthMbps: 300, usageMbps: 45, uptimePercent: 99.8 }
  ],
  vpnTunnels: [
    { id: "vpn-nsc-hq", targetSiteId: "site-hq", protocol: "WireGuard",
      status: "active", encryptionBits: 256, latencyMs: 28 }
  ],
}
```

**Producción** — el sitio se carga desde la API REST o Supabase y el hook
`useTelemetry` lo recibe automáticamente.

### 2. Lo que se actualiza automáticamente

| Componente | Qué pasa |
|---|---|
| **CORE-Map** | El nuevo nodo aparece proyectado en su coordenada geográfica. El bounding-box recalcula solo para mantener espaciado. |
| **Site Cards** (panel derecho) | Nueva tarjeta con barras de resiliencia y BW. |
| **ISP Monitor** | Si el sitio tiene un proveedor nuevo, aparece una tarjeta nueva. Si comparte proveedor existente, se agrega al conteo. |
| **ResilienceScore global** | Se recalcula ponderado por tipo de sitio (HQ=50%, branch=30%, remote/studio=10%). |
| **Alert Feed** | Recibe alertas del nuevo sitio en tiempo real. |
| **useTelemetry hook** | Aplica fluctuaciones al nuevo sitio igual que a los demás. |

---

## Flujo de integración con APIs de Routers (MikroTik RouterOS)

```
VERTIA CORE Dashboard
        │
        ▼
src/lib/api/mikrotik.ts          ← cliente REST para RouterOS API v7
        │
        ├── GET  /rest/interface  → estado de interfaces (enlace up/down)
        ├── GET  /rest/ip/traffic → throughput en tiempo real (BW usage)
        ├── GET  /rest/tool/ping  → latencia hacia gateway
        ├── GET  /rest/ip/firewall/filter → reglas de firewall activas
        ├── POST /rest/ip/firewall/filter → agregar/modificar reglas (Búnker Digital)
        ├── POST /rest/interface/wireguard → crear/modificar túneles VPN (Nexus-Link)
        └── POST /rest/system/script/run  → ejecutar scripts (Modo Contingencia)
```

### Acciones del dashboard que impactan los routers

| Acción UI | API RouterOS ejecutada |
|---|---|
| **Modo Contingencia** | Activa script de failover: deshabilita interfaces secundarias, eleva QoS Capa 1 |
| **Modo Cierre** | Aplica reglas firewall de priorización tráfico administrativo |
| **Reclamo Automático ISP** | Registra el incidente y puede ejecutar `interface disable` del enlace degradado |
| **Liberar Capa 3** | Modifica queue-tree de QoS para permitir tráfico ocio |
| **Vincular Nuevo Sitio** | Genera config WireGuard en el router destino via POST + agrega el site al dashboard |

### Esquema de autenticación

Cada router tiene credenciales almacenadas en variables de entorno:
```env
MIKROTIK_HQ_HOST=192.168.1.1
MIKROTIK_HQ_USER=vertia-api
MIKROTIK_HQ_PASS=<secret>
MIKROTIK_HQ_PORT=443       # HTTPS siempre, nunca HTTP
```

---

## Stack de producción sugerido

```
Frontend:   Next.js 15 + Tailwind + Framer Motion
Backend:    Next.js API Routes (server actions) → MikroTik REST
Datos:      Supabase (PostgreSQL) → snapshots históricos + alertas persistentes
Auth:       NextAuth.js → roles: Director (read-only) / Operador / Admin
Real-time:  Supabase Realtime o WebSocket propio para reemplazar useTelemetry
Depliegue:  Vercel (frontend) + VPS propio en Argentina (backend seguro)
```
