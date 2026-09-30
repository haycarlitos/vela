# Vela: assessment y plan a producción (v2)

> "Un Hermes para tu dinero en Starknet". Es un agente open source que cuida tu dinero con passkey, session keys, gas patrocinado, la IA de Chipi y x402. Puedes usar la versión hosteada o desplegar el tuyo.
>
> Fecha: 2026-09-27. Base: `@chipi-stack/*` 14.13.0.
>
> **v2 revisada contra el código fuente:**
> - `chipi-pay/sdks` (HEAD `8c0b4ab`; no hay cambios sin release en main);
> - `chipi-pay/chipi-back`;
> - `haycarlitos/walletv2`;
> - docs.chipipay.com (`llms-full.txt`).
>
> Referencias de agentes: Hermes Agent, Coinbase AgentKit, x402-foundation, starknet-agentic, ask-starknet.

### Qué cambió respecto a v1

1. **Chipi sí tiene una API de IA en vivo** (`api.chipipay.com/v1/ai/*`). El cerebro de Vela debe usarla y no llamar a Anthropic directo; eso elimina una dependencia y una API key.
2. **El guardián ya está construido en walletv2.** Son ~2,3k LOC, endurecidas con fixes de producción, pero todavía detrás de un feature flag. Se porta a Vela, idealmente pasando primero por el SDK.
3. **La guía de Chipi usa a Vela como ejemplo de "agente como proposer"** (`docs/sdk/guides/multisig-governance.mdx` §7).
4. **Correcciones a v1:**
   - agregar un guardián tarda **48 h**, no 24 h;
   - **no existe un guardián por email**: el guardián es una llave (otra wallet u otro dispositivo, o una passkey del contacto);
   - SHHH es el default desde 14.5/14.9, no desde 14.13;
   - usar `pk_` como bearer **no** es un hueco del backend: simplemente da 401, así que hoy el onboarding no funciona.

---

## 1. Veredicto

**Estamos a ~20 % de producción.** La cáscara está (UI ~80 %), pero al motor le falta casi todo (~15 %). Hoy **ningún flujo end-to-end funciona**:

- el onboarding da 401 porque no hay JWT;
- el agente no puede ejecutar;
- x402 no se cobra en el loop;
- el dashboard es 100 % demo.

La buena noticia es mayor que en v1. Entre el SDK, la API de IA de Chipi y walletv2 ya existe casi todo, así que el trabajo es **borrar y conectar**. Meta: un core de **~500 LOC** (hoy `lib/` + `app/api/` suman ~2.400).

| Área | Estado | Nota |
|---|---|---|
| Landing / marca / UI | ✅ 80 % | Tiers y Treasure fuera del OSS (§6) |
| Wallet (onboarding) | 🔴 20 % | Da 401 (usa `pk_` como bearer y no hay auth). Crea una wallet CHIPI legacy con PIN |
| Session keys | 🔴 10 % | `lib/session.ts` tiene **todos los campos mal**. Los selectores van como nombres. La sesión nunca llega al server |
| Límites de gasto | 🔴 0 % | Solo existen en el prompt |
| Cerebro IA | 🟡 30 % | Anthropic directo. `chipi-client.ts` apunta a endpoints que no existen |
| Loop del agente (cron) | 🔴 15 % | Single-tenant por env vars |
| x402 | 🟡 30 % | Hecho a mano. El cron no paga. `/test` simula el pago |
| Guardián / recovery | 🔴 0 % en Vela | 🟢 existe en walletv2 (se porta) |
| Dashboard | 🔴 5 % | 100 % `lib/demo-data.ts` |
| DB | 🔴 20 % | No es multi-tenant |
| Seguridad | 🔴 | `/api/agent/execute` sin auth. La API key de Infura está hardcodeada. `/api/init` es pública |
| OSS readiness | 🔴 | Sin README real, sin LICENSE, sin CI; `npm run lint` con 1 error |

---

## 2. Bugs críticos en Vela (verificados contra chipi-back)

1. **`lib/session.ts` tiene todos los campos mal.**
   - Envía `walletAddress` cuando debe ir `publicKey`.
   - Envía `signature` cuando debe ir `userSignature`.
   - Espera `prepareData.signature`, que el backend no devuelve: el backend no firma.
   - Lee `txHash` cuando el campo es `transactionHash`.
   - Manda `x-api-key: sk_`; ese header espera `pk_`.
   - El `ValidationPipe({whitelist:true})` descarta los campos desconocidos sin avisar.
   - Además, SHHH ni siquiera usa este camino: usa `execute-sponsored-raw`.
   - **Fix:** `getChipiServer().executeTransactionWithSession(...)`.
2. **Onboarding roto.** `getBearerToken: () => NEXT_PUBLIC_CHIPI_API_KEY` hace que el backend intente verificar `pk_…` como JWT, y responde 401 (`bearer-token.guard.ts:157`). Hace falta Clerk o Better Auth, con su JWKS registrado en el dashboard de Chipi.
3. **`allowedEntrypoints` con nombres.** El SDK los pasa crudos al contrato (`backend/src/sessions.ts:218`); deben ser selectores hex. Falta el swap de AVNU.
4. **La sesión se queda en el browser.** El cron usa `AGENT_SESSION_TOKEN`, que no existe en el modelo de Chipi.
5. **`POST /api/agent/execute` no tiene auth.** Hay que eliminarlo.
6. **Los límites solo viven en el prompt.**
7. **x402 es decorativo.** El cron no paga.
8. **La API key de Infura está hardcodeada** (`lib/config.ts:31`, `app/test/x402-pay.tsx:15`). Hay que rotarla y usar el proxy RPC de walletv2 (`lib/chipi/rpc.ts`).
9. **`lib/chipi-client.ts` usa paths y headers que no existen.**
   - Usa `x402.chipipay.com/api/ai/*`, `X-Chipi-Key` y `/intents`.
   - Lo real es `api.chipipay.com/v1/ai/*`, con `Bearer sk_` o `x-api-key: pk_`.
   - No hay intents.

---

## 3. Qué ofrece Chipi hoy y cómo lo usa Vela

### 3.1 Mapa de piezas

| Pieza | Qué usamos | Reemplaza en Vela |
|---|---|---|
| **Chipi AI API** (`/v1/ai/*`, REST, créditos prepagados a costo ×1.4) | `/think` (decisión de portafolio), `/signals` (RSI, MACD, Fear & Greed, yields; 100 gratis al mes y luego $0.0005), `/prices` (gratis), `/execute` (calldata de swap AVNU, $0.002), `/chat` + `/chat/stream` para "Ask AI" | `lib/agent-brain.ts`, `lib/chipi-client.ts`, precios de AVNU Impulse, `lib/defi/avnu.ts` y la dependencia `@anthropic-ai/sdk` |
| `@chipi-stack/nextjs` 14.13 | `ChipiProvider`; `useChipiWallet` (crea SHHH); `useAddSessionKeyToContract`, `useRevokeSessionKey`, `useGetTransactionList`; en `/server`: `getChipiServer` | Onboarding y feed |
| `@chipi-stack/chipi-passkey` 2.3 | `setupPasskey(userId, name, { requirePrf: true })` y `getWalletEncryptKey` | El PIN |
| `@chipi-stack/chipi-react` 14.13 | `useGuardianRecovery`, `useCallAnyContract`, `useX402Payment`; en `/multisig`: `<ApprovalInbox agentLabel="Vela">` | Guardián y aprobaciones |
| `@chipi-stack/backend` 14.13 | `sessions.createSessionKey`, `executeTransactionWithSession`, `getSessionData`, `getSpendingPolicy`, `createX402Facilitator`, `waitForTransaction` | `lib/session.ts`, `lib/x402-route.ts` y las confirmaciones |
| chipi-back REST | `/v1/guardians/*` (invitaciones A/B/C/D), `/v1/guardians/recovery-requests/*`, `/transactions/finalize-recovery`, webhooks `transaction.confirmed` / `failed` | El backend de guardianes y el polling |
| `@chipi-stack/starknet-connector` 0.3 | `chipi()` para usuarios con wallets externas | Conexión manual en `/test` |
| **walletv2** (código a portar) | `lib/chipi/{recovery,guardian-invites,friend-recovery,rpc,vesu,avnu}.ts`, `useWalletCreation`, `RecoveryAlert`, `GuardianNudge`, UI de sesiones (`edit-caps`, `cap-indicator`), la sección "Chipi Integration Playbook" de su `CLAUDE.md` | `lib/defi/*`, el RPC, el guardián y la UI de límites |

### 3.2 Estado por feature (verificado en el código)

**Wallets SHHH**
- Son el default en backend desde 14.5/14.9. En 14.13 se arregló el hook `useChipiWallet`.
- Crearlas como en walletv2:
  1. `setupPasskey({ requirePrf: true })`;
  2. `createWallet({ encryptKey, walletType: "SHHH" })`.
- Pasar `walletType: "SHHH"` en **cada** firma.
- Pedir `getWalletEncryptKey` primero y **después** un JWT fresco, porque el JWT expiraba durante la biometría (fix #233).
- ⚠️ Auditoría externa pendiente. Los flujos SHHH están "disponibles sin anuncio hasta que cierre la auditoría". **Beta con tope de depósito.**

**Sesiones: lo que funciona**
- El backend acepta SHHH en create, add, revoke, `setSpendingPolicy` y execute, y está probado en mainnet (`scripts/shhh-capped-autonomy-smoke.ts`).
- **El diseño de Vela es válido.** `executeTransactionWithSession` solo descifra la llave de sesión, nunca la del owner. El server genera la sesión cifrada con un secreto propio. Solo registrar, revocar y fijar la policy requieren la firma del owner.

**Sesiones: lo que falta o falla**
- `useChipiSession` y `supportsSessionKeys` solo aceptan CHIPI (`useChipiSession.ts:213`). Usar los hooks sueltos.
- **No hay hook de React para las spending policies**; solo existen en backend y piden el `encryptKey` del owner. Con passkey, ese `encryptKey` no debe salir del browser.
  - Mientras tanto: construir la llamada `set_spending_policy` y firmarla con `useCallAnyContract` en el cliente (~15 LOC).
- La policy rastrea `transfer`, `approve` e `increase_allowance`, pero **no `transfer_from`**.

**Guardianes: modelo on-chain**
- El guardián es un owner con rol GUARDIAN; se agrega con `propose_add_owner`.
- Timelocks: agregar tarda 48 h, remover 24 h y la recuperación 7 días.
- La recuperación **agrega** un owner; cualquier owner la puede cancelar. Las operaciones pendientes expiran 14 días después de `valid_after`.
- **No hay guardián por email.**

**Guardianes: tipos de guardián** (chipi-back + walletv2)

| Tipo | Quién es | Estado |
|---|---|---|
| A | Otro usuario Chipi | Consentimiento en inbox |
| B | Tu MetaMask o Phantom | Se confirma al instante |
| C | Un contacto que crea una passkey desde un link | Se puede inscribir, **pero no hay flujo de recovery** |
| D | Chipi como guardián (GaaS, requiere Plus) | Endpoints listos, **signer sin configurar** |

**Guardianes: estado en walletv2**
- Todo está detrás de `NEXT_PUBLIC_GUARDIANS_ENABLED`, porque el ciclo propose → 48 h → execute → 7 días → recover no se ha probado completo en mainnet.

**x402: lo que funciona**
- `createX402Facilitator` con `provider` (sin él, la firma solo se valida por presencia) y `nonceStore` en Postgres.

**x402: lo que falta o falla**
- `x402Middleware` es solo Express.
- Solo existe v1: `network: "starknet-mainnet"`, header `X-PAYMENT`, sin CAIP-2.
- Pagos con sesión (`s: "session"`): el facilitator **no los maneja**; con `provider` falla y sin él intenta re-liquidar.
- **Pagos SHHH:** el facilitator **no valida que el `oeCalldata` pague lo que dice el payload** (`facilitator.ts:170-181`). El vendedor debe verificar el evento `Transfer` on-chain.
- **Ningún cliente Node paga x402 con una llave de sesión.** `X402ShhhClient` firma con la llave del owner (inaceptable en un server).
- Para el agente de Vela, el camino es:
  1. `executeTransactionWithSession(transfer USDC)`;
  2. `X-PAYMENT` con `{ r: txHash, s: "session" }`;
  3. el servidor verifica el `Transfer` con `waitForTransaction`.
  - Son ~25 LOC en total, hasta que el SDK lo resuelva.

**API de IA de Chipi**
- Es real y está documentada (`docs/services/ai-api/*`).
- Modelos: haiku (default), sonnet, gpt-4.1, gpt-4o, gemini.
- Se cobra con créditos de la org, **no con x402**. Las llaves `pk_dev_` devuelven respuestas sandbox.
- ⚠️ `/think` en el backend devuelve `swap|supply|withdraw|hold`, pero la documentación dice `hold|buy|sell`. Hay que alinearlos.
- ⚠️ `/signals` necesita ~7 min de historial de precios tras cada boot.

**Agente como proposer de multisig** (`multisig-governance` §7, rama `feat/ai-proposer-smoke`)
- El agente es un owner STARK extra, con `dailyBudgetBase`.
- Lo que cae dentro del presupuesto se auto-aprueba; lo demás se escala a `<ApprovalInbox>`.
- ⚠️ El presupuesto lo aplica **la app, no el contrato**.
- En Vela se usa como **capa de escalamiento** (fase 2). La autonomía base usa sesión + spending policy on-chain.

**Conector, MCP, skills**
- Conector: v0.3, solo popup, solo mainnet.
- `mcp.chipipay.com` es un registry de componentes para Cursor, no un MCP de wallet, y **su certificado TLS expiró**.
- Las skills de `chipi-pay/skills` **y** algunas páginas de docs están desactualizadas (ver §7).

---

## 4. Arquitectura objetivo

### 4.1 Flujo

```
Usuario (browser)                           Vela server                           Chipi / Starknet
─────────────────                           ───────────                           ────────────────
1. Clerk login → setupPasskey(PRF) → createWallet SHHH  ─────────────────────────▶ deploy gasless
2. "Contratar agente"  ──POST /api/agents──▶ sessions.createSessionKey(VELA_SESSION_SECRET)
                                             guarda {pubkey, encPriv} en DB
3. firma con passkey (una sola vez):
   useAddSessionKeyToContract(selectores hex)          ───────────────────────────▶ sesión 7d
   useCallAnyContract(set_spending_policy USDC/ETH/STRK) ─────────────────────────▶ caps on-chain
4. (opcional) GuardianNudge → guardián tipo B o A                ─────────────────▶ propose_add_owner (48h)
5. cron /api/tick por agente activo:
   a. POST /v1/ai/signals  → ¿hay señal? si no, [SILENT] y $0      (sk_, server-side)
   b. POST /v1/ai/think    → decisión + razón                      (créditos Chipi)
   c. policy.ts            → valida la acción (determinista)
   d. calls: /v1/ai/execute (swap AVNU) | vesu.ts (supply/withdraw)
   e. executeTransactionWithSession(calls) → waitForTransaction ──────────────────▶ tx
   f. log decisión + tx + costo; webhook transaction.confirmed → feed
6. "Detener" → useRevokeSessionKey                                ────────────────▶ revocada
```

### 4.2 Dónde entra x402: Vela como API que cobra

- `/api/think` de Vela envuelve `/v1/ai/think` + SOUL + skills + memoria, y **cobra $0.001 por x402**. Con eso:
  - un agente self-hosted sin cuenta Chipi ni API key paga por decisión desde su wallet;
  - el agente hosteado de Vela **se paga a sí mismo** (en el paso 5b va por `/api/think` con x402, usando su sesión). Es la demo "el agente paga por pensar".
- Quien tenga su propia `CHIPI_SECRET_KEY` llama `/v1/ai/think` directo.
- Resumen: **Chipi cobra créditos a Vela; Vela cobra x402 a los agentes.** Es el modelo de plataforma que Chipi puede copiar después (gap #7).

### 4.3 Estructura de archivos

```
agent/SOUL.md, agent/policy.json           ← Hermes / starknet-agentic
skills/{yield,dip-buyer,stop-loss}/SKILL.md ← Hermes / agentskills.io (frontmatter: name, description, llm: bool)
lib/
  chipi.ts     ~40  getChipiServer(), chipiAi(path, body) con sk_, execWithSession(), SELECTORS
  policy.ts    ~50  guard determinista
  brain.ts     ~60  signals → think (+ SOUL + skill activa + MEMORY) → acción
  x402.ts      ~50  adapter App Router + verificación on-chain de pagos con sesión
  defi/vesu.ts      (de walletv2)
  rpc.ts            (de walletv2, proxy /api/rpc)
  db.ts        ~80  agents, decisions, memory, x402_nonces
app/api/{agents,think,tick,rpc}/route.ts
app/api/{mcp,telegram}/route.ts             ← fase 2
```

**Se borra:**
- `lib/chipi-client.ts`, `lib/session.ts`, `lib/x402-route.ts`
- `lib/agent-brain.ts` (pasa a `brain.ts`), `lib/defi/avnu.ts` (lo cubre `/v1/ai/execute`), `lib/defi/portfolio.ts` (precios)
- `app/api/{agent/execute,test-x402,ping,init}` y `app/test/*`
- La dependencia `@anthropic-ai/sdk`

---

## 5. Plan por fases

### Fase 0: higiene (1–2 días)

- [ ] **Quitar el `pk_prod_11bc…` real de `.env.example`** y rotarlo si la org tiene créditos de IA (gap #1: ese `pk_` basta para gastar créditos de `/v1/ai/*`). Verificado en `chipi-back/src/auth/api-key.guard.ts:40` y `ai.controller.ts:192-670`.
- [ ] Rotar la API key de Infura y portar `rpc.ts` + `/api/rpc` de walletv2.
- [ ] En `.env.example`, poner placeholders: `CHIPI_SECRET_KEY`, `NEXT_PUBLIC_CHIPI_API_KEY`, `VELA_SESSION_SECRET`, `POSTGRES_URL`, `MERCHANT_WALLET`, `CLERK_*`.
- [ ] Borrar los endpoints inseguros o de prueba.
- [ ] Agregar LICENSE, README, SECURITY.md y CI (lint + typecheck).
- [ ] Copiar el "Chipi Integration Playbook" de walletv2 (`CLAUDE.md:463-543`) al `CLAUDE.md` de Vela. Evita que los agentes de código repitan los errores conocidos.

### Fase 1: MVP (≈1 semana; menos que en v1 gracias a la AI API y walletv2) → beta con tope de depósito

- [ ] Clerk con su JWKS registrado en Chipi, y `proxy.ts` (Next 16).
- [ ] Onboarding con el patrón de `useWalletCreation` de walletv2 (passkey con PRF y SHHH).
- [ ] Contratar agente:
  - `/api/agents` con la sesión generada en el server;
  - `useAddSessionKeyToContract` con los selectores hex (`approve`, `transfer`, `deposit`, `redeem`, `multi_route_swap`);
  - `set_spending_policy` firmado con `useCallAnyContract`;
  - UI `edit-caps` / `cap-indicator` portada de walletv2.
- [ ] `brain.ts` sobre `/v1/ai/signals` + `/v1/ai/think`.
- [ ] `policy.ts`.
- [ ] `/api/tick` multi-tenant.
- [ ] Swaps con `/v1/ai/execute`; Vesu con `vesu.ts` de walletv2.
- [ ] `/api/think` con cobro x402 (facilitator in-process + verificación on-chain), y el tick pagándose a sí mismo.
- [ ] Dashboard real: feed con `useGetTransactionList` y webhooks.
- [ ] Botón "Detener" (`useRevokeSessionKey`).
- [ ] "Ask AI" con `/v1/ai/chat/stream`.
- [ ] Scheduler: Vercel Pro cron o QStash (el plan Hobby solo permite cron diario).

**Criterio de salida:** 3 wallets internas con $20 cada una durante 72 h. Cada decisión queda con su tx, su pago x402 y su costo de IA visibles.

### Fase 2: el "Hermes" + guardián (≈2 semanas)

- [ ] **Guardián (retomado de walletv2).**
  - Portar `recovery.ts`, `guardian-invites.ts`, `RecoveryAlert`, `PendingRecoveryActions` y `GuardianNudge`.
  - Empezar con el **tipo B** (tu MetaMask/Phantom: no requiere un segundo usuario) y el **tipo A** (amigo Chipi).
  - Los tipos C y D, cuando exista su flujo de recovery y el signer GaaS.
  - **`RecoveryAlert` es obligatorio en Vela.** Con un agente activo, el owner debe enterarse y poder cancelar si alguien inicia una recuperación.
  - Mejor ruta: **mover `useRecoveryService` de walletv2 al SDK** (`chipi-react`) y que Vela solo lo importe. Así el episodio del guardián queda en ~60 LOC en lugar de ~2k.
- [ ] Memoria (`MEMORY.md` limitada a ~2k caracteres) y SOUL editable.
- [ ] Aprobaciones humanas: lo que exceda la policy se escala con el patrón de agente como proposer y `<ApprovalInbox agentLabel="Vela">`. Validar con la rama `feat/ai-proposer-smoke`.
- [ ] Telegram (`/status`, `/pause`, `/approve`), con pairing y denegación por default.
- [ ] `/api/mcp`: expone las tools de Vela a Claude o Hermes.
- [ ] "Connect with Chipi" para pagadores x402 externos.

### Fase 3: plataforma

- `npm create vela-agent`.
- Skills comunitarias y leaderboard.
- Modo privado (`useShield`; la base ya existe en walletv2, `lib/chipi/privacy.ts`).
- Endur y Nostra.

---

## 6. Recomendaciones de producto

- **Tiers, Treasure y referidos fuera del core OSS.** El Treasure es un sorteo con dinero y tiene riesgo legal.
- **Navigator = una skill con `llm: false`.** Solo usa `/v1/ai/signals` (100 llamadas gratis al mes) y no paga `/think`.
- **Seguridad en capas:**
  1. on-chain: selectores + `maxCalls` + spending policy;
  2. `policy.ts`;
  3. escalamiento a humano;
  4. guardián + `RecoveryAlert`.

---

## 7. Gaps de Chipi (sdks, chipi-back, docs), priorizados

| # | Prio | Gap | Dónde | Fix |
|---|---|---|---|---|
| 1 | 🔴 Seg | **Las rutas de IA facturables aceptan `x-api-key: pk_`**, y el `pk_` es público por diseño (`NEXT_PUBLIC_`). Cualquiera que lo copie de un bundle gasta los créditos de IA de la org, y no hay rate limit por org (`RateLimitGuard` existe pero no se aplica) | `chipi-back auth/api-key.guard.ts`, `ai.controller.ts` | Exigir `sk_` o JWT en `/v1/ai/*` y aplicar `RateLimitGuard` |
| 2 | 🔴 Seg | El facilitator no valida que el `oeCalldata` SHHH pague monto y `payTo` | `sdks backend/src/x402/facilitator.ts:170-181` | Decodificar el OE y comparar; o verificar el `Transfer` después de liquidar |
| 3 | 🔴 | Pagos x402 con sesión (`s: "session"`) sin soporte en el facilitator, y sin cliente Node que pague con sesión (`X402ShhhClient` usa la llave del owner) | `facilitator.ts`, `shhh-client.ts` | Verificación on-chain del `Transfer` + `X402SessionClient` |
| 4 | 🟠 | `useChipiSession` y `supportsSessionKeys` solo aceptan CHIPI | `useChipiSession.ts:213`, `useChipiWallet.ts:231` | Aceptar SHHH |
| 5 | 🟠 | No hay hook de React para spending policies (solo backend, que pide el `encryptKey` del owner) | `chipi-react/src/hooks` | `useSetSpendingPolicy` |
| 6 | 🟠 | x402 sin wrapper para App Router | `nextjs/src/server` | `withX402(handler, { amount })`, que liquide solo si la respuesta es < 400 |
| 7 | 🟠 | La API de IA no tiene cliente en el SDK ni cobro x402 | — | `sdk.ai.*` y pago por x402 como alternativa a créditos (agentes sin cuenta) |
| 8 | 🟠 | Los selectores pasan crudos; **docs y skills** usan nombres (`x402-sessions.mdx:55,130`). El ejemplo con `DirectSigner` no genera una firma de sesión | `sessions.ts:218` + docs | Convertir nombres a selectores; corregir los docs |
| 9 | 🟠 | Mensajes contradictorios: el changelog 14.13 dice que SHHH "no tiene session keys"; `multisig-governance.mdx:650` dice "próximamente"; el código y los docs de spending policies dicen que sí funciona | CHANGELOG + docs | Unificar el mensaje |
| 10 | 🟠 | Guía contradictoria sobre guardar sesiones en backend (`sessions-quickstart` dice "nunca"; `gasless/sessions` dice "en tu secrets store") | docs | Documentar el patrón de agente server-side |
| 11 | 🟡 | `/v1/ai/think`: el código devuelve `swap/supply/withdraw/hold` y los docs dicen `hold/buy/sell` | chipi-back vs docs | Alinear |
| 12 | 🟡 | La lógica de guardianes vive en walletv2, no en el SDK | walletv2 `lib/chipi/recovery.ts` | Subir `useRecoveryService` a `chipi-react` |
| 13 | 🟡 | `mcp.chipipay.com` tiene el certificado TLS expirado | infra | Renovarlo |
| 14 | 🟡 | `useX402Payment` y `useGuardianRecovery` no se re-exportan en nextjs (los docs dicen que sí) | `nextjs/src/hooks.ts` | Re-exportar |
| 15 | 🟡 | El export de `backend/sku-purchases` apunta a un archivo que no existe | `tsup.config.ts:8` vs `package.json:84` | Arreglar el `exports` map |
| 16 | 🟡 | x402 v1 propietario frente al spec v2 `scheme_exact_starknet` | — | `@x402/starknet` upstream |
| 17 | 🟡 | chipi-back: secret keys en texto plano; JWKS sin `kid` | `schema.prisma`, `bearer-token.guard.ts:236` | Hash + selección por `kid` |
| 18 | ⚪ | La auditoría externa de SHHH V8.4 está pendiente | — | Phase 13 |

**Para que Vela sea mínimo, los que más pesan son #3, #4, #5, #6, #7 y #12.** Cada uno borra entre 20 y 2.000 LOC de Vela y deja un episodio de video en "importa y llama".

---

## 8. Serie de videos

| # | Episodio | Chipi | LOC |
|---|---|---|---|
| 1 | Tu wallet con huella | Clerk + `setupPasskey(PRF)` + SHHH | 60 |
| 2 | Una llave con límites para tu agente | `createSessionKey` + `useAddSessionKeyToContract` | 70 |
| 3 | Límites que ni el agente puede romper | spending policy on-chain | 40 |
| 4 | El cerebro en 20 líneas | `/v1/ai/signals` + `/v1/ai/think` | 40 |
| 5 | Ejecuta sin gas | `/v1/ai/execute` + `executeTransactionWithSession` + `waitForTransaction` | 50 |
| 6 | Tu API que cobra | x402 en `/api/think` | 50 |
| 7 | Un agente que paga por pensar | Pago x402 con sesión | 30 |
| 8 | Estrategias en Markdown | Skills + SOUL + policy guard | 100 |
| 9 | Si pierdes tu teléfono | Guardián + `RecoveryAlert` | 60 (con #12 resuelto) |
| 10 | Pídele permiso a tu humano | Agente como proposer + `<ApprovalInbox>` | 60 |
| 11 | Háblale por Telegram | Gateway | 120 |
| 12 | Tu wallet dentro de Claude | MCP | 40 |
| 13 | Despliega el tuyo | Deploy button | — |

---

## 9. Decisiones abiertas

1. ¿Arreglamos primero en el SDK los gaps #1–#7 y #12 (menos código en Vela, mejores videos) o avanzamos Vela con workarounds en paralelo? **Recomiendo:** arreglar ya #1 (seguridad) y avanzar Vela con workarounds marcados `// TODO(sdk#N)`.
2. Auth: ¿Clerk, igual que walletv2?
3. ¿Vela paga la IA con créditos de su org y la revende por x402 a otros agentes? (§4.2)
4. Guardián en la v1 de Vela: ¿tipo B y A tras un flag, o esperar a probar el ciclo completo en mainnet con walletv2?
5. Scheduler: ¿Vercel Pro o QStash?
