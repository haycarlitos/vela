# Vela: assessment y plan a producción

> "Un Hermes para tu dinero en Starknet". Es un agente open source que cuida tu dinero con passkey, session keys, gas patrocinado y x402. Puedes usar la versión hosteada o desplegar el tuyo.
>
> Fecha: 2026-09-27. Base: `@chipi-stack/*` 14.13.0 (release del 2026-09-09).

**Fuentes.**
- El proxy de esta sesión bloqueó `docs.chipipay.com` y todo `*.chipipay.com` (403).
- La información del SDK viene de:
  - los tarballs publicados en npm (los `.d.ts` y el runtime);
  - los diffs entre versiones;
  - los repos públicos `chipi-pay/build-with-chipi`, `chipi-pay/skills`, `chipi-pay/sessions-smart-contract`, `chipi-pay/account-registry` y `haycarlitos/shhh-wallet-cairo`.
- No pude leer los repos privados: `sdks`, `x402-facilitator`, `mcp` y `chipi-agent`.
- Los repos de referencia de agentes que revisé: NousResearch/hermes-agent, coinbase/agentkit, x402-foundation/x402, keep-starknet-strange/starknet-agentic y kasarlabs/snak + ask-starknet.

---

## 1. Veredicto

**Estamos a ~20 % de producción.** La cáscara está (landing, UI y copy de ~80 %), pero al motor le falta casi todo (~15 %). Hoy **ningún flujo end-to-end funciona con dinero real**:

- el agente no puede ejecutar;
- x402 no se cobra en el loop;
- el dashboard es 100 % demo.

Lo bueno: el SDK 14.13 ya trae casi todo lo que el repo reimplementa a mano. El camino a producción consiste en **borrar código más que escribirlo**. La meta es que el core del agente quepa en **~600 LOC** (hoy `lib/` + `app/api/` suman ~2.400).

| Área | Estado | Nota |
|---|---|---|
| Landing / marca / UI glass | ✅ 80 % | Pulir el copy para OSS (tiers y treasure, ver §6) |
| Wallet (onboarding) | 🟡 40 % | Crea wallets CHIPI legacy con PIN. Sin passkey, sin auth real (usa el `pk_` como bearer) |
| Session keys | 🔴 10 % | Pasa selectores como nombres, la sesión nunca llega al server y `lib/session.ts` inventa la API |
| Límites de gasto | 🔴 0 % | Solo existen en el prompt. Falta `setSpendingPolicy` on-chain y falta el guard en código |
| Loop del agente (cron) | 🔴 15 % | Single-tenant por env vars. `AGENT_SESSION_TOKEN` no existe en el modelo de Chipi |
| x402 | 🟡 30 % | Middleware hecho a mano contra un facilitator remoto. El cron **no paga**. La página `/test` manda un `r=txHash` simulado |
| Dashboard | 🔴 5 % | 100 % `lib/demo-data.ts` |
| DB | 🔴 20 % | Sin `user_id`/`agent_id`; todas las decisiones son globales. `DATABASE_URL` vs `POSTGRES_URL` inconsistente |
| Seguridad | 🔴 | `/api/agent/execute` no tiene auth. La API key de Infura está hardcodeada en 2 archivos. `/api/init` es pública |
| OSS readiness | 🔴 | README default de Next, sin LICENSE, sin deploy button, sin tests, `npm run lint` con 1 error |

---

## 2. Bugs críticos encontrados en el repo

1. **`lib/session.ts` no firma nada.**
   - Llama a `prepare-typed-data` y luego manda `prepareData.signature`, que no existe.
   - Nunca descifra la llave de sesión ni firma `[pubkey, r, s, validUntil]`.
   - **Fix:** `getChipiServer().executeTransactionWithSession(...)`, que ya existía en 14.0.0 y está instalado.
2. **`allowedEntrypoints: ["transfer", "approve", ...]`** (`components/onboarding/configure-agent.tsx:48`).
   - El contrato espera **selectores hex** (`hash.getSelectorFromName`).
   - Además, el selector de swap de AVNU no está en la lista, así que los swaps fallarían.
3. **La sesión creada en onboarding se queda en el browser.** El cron usa `AGENT_WALLET_ADDRESS`/`AGENT_SESSION_TOKEN` desde env, así que el agente contratado nunca corre.
4. **`POST /api/agent/execute` no tiene auth.** Cualquiera que tenga un session blob puede ordenar trades. Hay que eliminarlo: la ejecución vive solo en el tick del server.
5. **Los límites ($5/trade, $10/día, 30 %, reserva x402) solo viven en el prompt.** Un LLM no es un control de riesgo. Deben existir:
   - on-chain, con `setSpendingPolicy`;
   - en código, con un policy guard antes de ejecutar.
6. **x402 es decorativo en el loop.** El cron llama a Claude directo, sin pagar. La promesa "el agente paga por su propio cerebro" no ocurre.
7. **`useChipiWallet` usa el `pk_` como bearer token.** No hay identidad: cualquiera que escriba el `externalUserId` "carlos" ve su wallet.
8. **La API key de Infura está hardcodeada** en `lib/config.ts:31` y `app/test/x402-pay.tsx:15`. Hay que rotarla y moverla a env.
9. **P&L con `initialDeposit = 10` hardcodeado** y `x402_spent_total += 0.001` aunque no se pagó.

---

## 3. Qué trae el SDK de Chipi 14.13 y cómo lo usamos

### 3.1 Mapa paquete → uso en Vela

| Paquete (versión) | Qué usamos | Reemplaza en Vela |
|---|---|---|
| `@chipi-stack/nextjs` 14.13.0 | `ChipiProvider`, `useCreateWallet` (con `usePasskey: true`), `useGetWallet`, `useGetTokenBalance`, `useGetTransactionList`; en `/server`: `createChipiServer`/`getChipiServer` | Onboarding, `fund-wallet`, activity feed |
| `@chipi-stack/chipi-react` 14.13.0 | `useAddSessionKeyToContract`, `useRevokeSessionKey`, `useGetSessionData`, `useX402Payment` (no se re-exporta en nextjs), `useGuardianRecovery`, `<Recover>`; en `/multisig`: `<ApprovalInbox>` | Hire agent, stop agent, guardianes |
| `@chipi-stack/backend` 14.13.0 | `sessions.createSessionKey`, `executeTransactionWithSession`, `setSpendingPolicy`/`getSpendingPolicy`, `getSessionData`, `createX402Facilitator`, `waitForTransaction` | `lib/session.ts` (111 LOC), `lib/x402-route.ts` (138 LOC) y las confirmaciones |
| `@chipi-stack/x402` 14.13.0 | `X402ShhhClient` / `X402Client` para que **el agente pague** su "think" desde Node | El pago que hoy falta en el cron |
| `@chipi-stack/chipi-passkey` 2.3.0 | `createWalletPasskey` (PRF obligatorio y manejo de `PrfUnsupportedError`), `usePasskeyAuth` | El PIN como factor principal |
| `@chipi-stack/starknet-connector` 0.3.0 | `chipi()` como conector de starknet-react ("Connect with Chipi") | Las ~150 LOC de conexión manual a Argent/Braavos en `/test` |
| `@chipi-stack/core` 0.6.0 | (opcional) `TxBuilder` + `ChipiPaymasterAdapter` para wallets externas | — |

### 3.2 Estado por feature

**SHHH wallets**
- Qué son: el tipo de cuenta **`SHHH` V8.4**, que es el default desde 14.13.
  - Tiene signers enchufables (STARK, passkey P-256, EIP-191, ED25519…).
  - Admite multi-owner con threshold.
  - Los cambios de owners pasan por timelocks.
  - Tiene guardianes.
  - Soporta session keys SNIP-163 con spending caps.
- **Vela debe usar SHHH**, porque los spending caps están probados en mainnet sobre SHHH. En CHIPI v29 requieren upgrade a v33.
- ⚠️ La auditoría externa de V8.x está **pendiente**; hasta ahora solo hubo revisiones internas. **Bloqueante de comunicación:** lanzar como "beta" con tope de depósito (p. ej. $100 por wallet) hasta que salga la auditoría.

**Sesiones**
- Funcionales en backend para CHIPI y SHHH: `createSessionKey`, `addSessionKeyToContract`, `executeTransactionWithSession`, `revokeSessionKey`, `getSessionData`.
- Spending policy por sesión y token: `maxPerCall`, `maxPerWindow`, `windowSeconds`. Se aplica sobre `transfer`/`approve`/`increase_allowance`, que es justo lo que usan AVNU y Vesu.
- ⚠️ `useChipiSession` y `wallet.supportsSessionKeys` solo aceptan `walletType === "CHIPI"`, así que con SHHH lanzan "Wallet does not support sessions".
  - Mientras tanto usamos los hooks individuales, que sí aceptan SHHH.

**Guardianes**
- Solo en SHHH: `useGuardianRecovery` y `<Recover mode="guardian-recovery">`.
- Timelocks: agregar un guardián tarda 24 h y la recuperación 7 días.
- La recuperación **agrega** un owner, no quita ninguno, y el veto necesita un owner sobreviviente.
- Para Vela es un paso opcional del onboarding: "agrega un guardián (el email de alguien de confianza)".
- Los componentes son headless y no se re-exportan en `nextjs`.

**x402**
- `createX402Facilitator` con `provider` (obligatorio: sin él la firma solo se valida por presencia) y `nonceStore` en Postgres.
- Del lado cliente:
  - `useX402Payment` (React);
  - `X402ShhhClient` (Node, que solo admite el signer STARK);
  - `X402Client`.
- ⚠️ `x402Middleware` es **solo Express**; no hay wrapper para App Router.
- ⚠️ Pagos con sesión (`signature: { r: txHash, s: "session" }`): el `X402Facilitator` del SDK **no los maneja** (lo verifiqué en el runtime). Hay que usar `verifyOnly` y verificar nosotros el evento `Transfer` con `waitForTransaction`, o confirmar que el facilitator hosteado lo hace.
- El protocolo va en v1 (`network: "starknet-mainnet"`, header `X-PAYMENT`).
  - El spec oficial `x402-foundation/x402` ya tiene `scheme_exact_starknet` en v2: CAIP-2 `starknet:SN_MAIN`, SNIP-9 outside execution y `extra.feePayer`.
  - No existe un paquete `@x402/starknet`. **Oportunidad:** que Chipi lo publique upstream.

**Conector** (`@chipi-stack/starknet-connector` 0.3.0)
- v1: solo popup, solo mainnet, una aprobación a la vez.
- Probado: abre la wallet hosteada en producción y convive con otros conectores.
- **No se ha probado** el round-trip completo passkey → firma → ejecución.
- Uso en Vela: dejar que usuarios de Argent/Braavos/Cartridge paguen x402 o conecten su cuenta. No lo necesitamos para el camino feliz, porque el usuario nuevo crea su wallet Chipi.

**IA de Chipi**
- **No hay** API de IA en ningún paquete público.
- `lib/chipi-client.ts` (441 LOC) implementa un "design brief" (`/api/ai/intents`, `/signals`, `/prices`) que no está publicado.
- Recomendación: borrar ese archivo. El cerebro de Vela **es** la demo de "API de IA pagada con x402" (ver §4). Si la API de IA de Chipi ya está viva, se consume por x402 con la misma interfaz: una sola variable `THINK_URL`.

**MCP y skills**
- `https://mcp.chipipay.com/mcp` está documentado, pero no pude verificar que esté vivo.
- `chipi-pay/skills` v1.2.0 tiene 17 skills; varias están **desactualizadas**. Detalle en §7.

**Otros**
- Private balances (`useShield`/`useUnshield`, pool STRK20). Requiere allowlist, cuesta 4 STRK por operación y tarda 2–3 min de prueba. Es la fase 3: "guarda tus ganancias en privado".
- SKUs: solo México. No aplican.
- Vesu: los hooks del SDK están comentados.
- AVNU: no tiene integración en el SDK. Mantener nuestros builders (~150 LOC).

---

## 4. Arquitectura objetivo (mínimo código)

### 4.1 Flujo de sesión

La idea central: **la llave de sesión nace y vive en el server**. El usuario solo firma, con su passkey, el registro de esa llave pública y la spending policy.

```
Usuario (browser)                      Vela server                              Starknet
─────────────────                      ───────────                              ────────
1. passkey → wallet SHHH  ───────────────────────────────────────────────────▶  deploy (gasless)
2. "Contratar agente"      ──POST /api/agents──▶ createSessionKey(SERVER_KEY)
                                                 guarda {pubkey, encPriv}
3. firma con passkey:      ◀──── pubkey ────────
   addSessionKeyToContract(selectores AVNU/Vesu/ERC20)  ───────────────────▶  sesión 7d
   setSpendingPolicy(USDC, maxPerCall, maxPerDay)       ───────────────────▶  caps on-chain
4. cron /api/tick (cada N min, por agente activo):
     a. X402Client paga $0.001 ──▶ /api/think (x402)  ──▶ Claude + skills + memoria
     b. policy.ts valida la acción (determinista)
     c. executeTransactionWithSession(calls)  ──────────────────────────────▶  swap / Vesu
     d. waitForTransaction → logea decisión + tx + costo x402
5. "Detener"  → useRevokeSessionKey (firma passkey)  ──────────────────────▶  revocada
```

### 4.2 Por qué es "Hermes para tu dinero" y además plataforma

- **`/api/think` es un producto por sí mismo.** Es una API de IA con cobro x402 de $0.001 por llamada.
  - Un agente self-hosted pone `THINK_URL=https://vela.xyz/api/think` y paga por decisión desde su propia wallet, sin API key de Anthropic.
  - Quien quiera correr su propio cerebro pone `ANTHROPIC_API_KEY`, y el mismo endpoint local se usa sin cobro.
  - Así la plataforma gana dinero y el OSS sigue siendo 100 % desplegable.
- **Tres capas de límites:**
  1. on-chain: `maxCalls`, selectores, `setSpendingPolicy`;
  2. `agent/policy.json` en código;
  3. el prompt.
  - Solo la tercera es "suave".

### 4.3 Estructura de archivos objetivo

```
agent/
  SOUL.md              # personalidad + apetito de riesgo (editable por el usuario)   ← Hermes
  policy.json          # límites duros: maxPerTrade, dailyCap, tokens, protocolos, slippage ← starknet-agentic policyGuard
skills/
  yield/SKILL.md       # "mueve USDC ocioso a Vesu si APY > X"                         ← Hermes / agentskills.io
  dip-buyer/SKILL.md
  stop-loss/SKILL.md
lib/
  chipi.ts       ~30   # getChipiServer() + execWithSession() + selectores permitidos
  tools.ts       ~80   # registry {name, description, zod schema, risk, execute}      ← AgentKit / ask-starknet
  policy.ts      ~50   # guard determinista, corre ANTES de ejecutar
  brain.ts       ~80   # Claude tool-use + SOUL + skills (solo descripciones) + MEMORY
  x402.ts        ~40   # adapter App Router sobre sdk.createX402Facilitator (hasta que viva en el SDK)
  defi/avnu.ts, vesu.ts, portfolio.ts   (se quedan, ~300)
  db.ts          ~80   # agents, decisions, memory, x402_nonces (multi-tenant)
app/api/
  agents/route.ts      # crear agente (auth), devuelve session pubkey
  think/route.ts       # x402-protected brain (público)
  tick/route.ts        # cron: itera agentes activos
  mcp/route.ts         # fase 2: expone tools.ts como MCP (~40 LOC)                  ← AgentKit getMcpTools
  telegram/route.ts    # fase 2: /status /pause /approve                              ← Hermes gateway
```

### 4.4 Qué se borra

- `lib/chipi-client.ts` (441)
- `lib/session.ts` (111)
- `lib/x402-route.ts` (138), reemplazado por ~40 LOC
- `app/api/agent/execute`, `app/api/test-x402`, `app/api/ping` y `app/api/init`; este último pasa a ser `scripts/migrate.ts`
- `app/test/*`: pasa a un ejemplo `examples/pay-x402` con el conector
- `lib/demo-data.ts`: pasa a ser un fallback de `?demo=1`

Son unas ~1.100 LOC eliminadas.

---

## 5. Plan por fases

### Fase 0: higiene y seguridad (1–2 días)

- [ ] Rotar la API key de Infura y moverla a `STARKNET_RPC_URL` en env.
- [ ] En `.env.example`, poner placeholders, sin `pk_prod` real ni wallet real.
- [ ] Borrar `/api/agent/execute` y `/api/test-x402`, y proteger `/api/init`.
- [ ] Agregar `LICENSE` (MIT o Apache-2.0), un README real, `CONTRIBUTING.md` y `SECURITY.md`.
- [ ] Arreglar el error de lint y agregar CI (lint + typecheck).
- [ ] Unificar la DB: `POSTGRES_URL` (Neon / Vercel Postgres) y ajustar CLAUDE.md.
- [ ] Hacer que el modelo sea configurable (`VELA_MODEL`): Haiku 4.5 para ticks y un modelo Sonnet para "Ask AI". Hoy CLAUDE.md dice Sonnet y el código usa Haiku.

### Fase 1: MVP real, un agente por usuario (≈1–1,5 semanas) → beta pública con tope de depósito

- [ ] Actualizar a `@chipi-stack/nextjs@14.13` y agregar `@chipi-stack/backend` y `@chipi-stack/chipi-react` como dependencias directas.
- [ ] **Auth:** Clerk, que es el único provider con tutorial validado. Registrar el JWKS en el dashboard de Chipi. Usar `getToken()` como bearer; nunca el `pk_`. En Next 16 las rutas se protegen en `proxy.ts`.
- [ ] **Onboarding:**
  - `useCreateWallet({ usePasskey: true })` con wallet SHHH y PIN de respaldo;
  - manejar `PRF_UNSUPPORTED` (volver a PIN y avisar);
  - `useGetTokenBalance` para el paso de fondeo.
- [ ] **Contratar agente:**
  - `POST /api/agents` genera la sesión en el server;
  - el cliente llama `useAddSessionKeyToContract` con selectores hex (`approve`, `deposit`, `redeem`, `multi_route_swap` y el `transfer` que x402 necesita);
  - el cliente llama `setSpendingPolicy` para USDC, ETH y STRK con los topes de la UI.
- [ ] `lib/policy.ts` + `agent/policy.json`. Todo bloqueo se registra como decision card con su razón.
- [ ] `lib/brain.ts` con tool use (sin regex para parsear JSON), SOUL.md y skills.
- [ ] `/api/tick` multi-tenant:
  - `SELECT` de los agentes activos;
  - pago x402 a `/api/think`;
  - guard;
  - `executeTransactionWithSession`;
  - `waitForTransaction`.
- [ ] Facilitator in-process con `nonceStore` en Postgres. Los pagos por sesión se verifican on-chain.
- [ ] Dashboard con datos reales (`/api/agent/status?agent=` con auth) y `useGetTransactionList`.
- [ ] Botón "Detener": `useRevokeSessionKey` + `agents.active=false`.
- [ ] Deploy: botón "Deploy to Vercel" con las env vars requeridas.
  - ⚠️ El plan Hobby de Vercel solo permite cron diario; se necesita Pro, o un cron externo como Upstash QStash o un GitHub Action.

**Criterio de salida:** con 3 wallets internas, $20 cada una y 72 h corriendo, cada decisión tiene su tx y su pago x402 visible en el explorer y en el dashboard, sin intervención manual.

### Fase 2: el "Hermes" (≈2 semanas)

- [ ] `MEMORY.md` por agente, limitado a ~2k caracteres, guardado en DB y escrito con la tool `remember`. Se inyecta como snapshot al inicio de cada tick para no romper el cache del prompt.
- [ ] Aprobaciones humanas (`approvals.mode: auto | threshold | manual`). Lo que exceda la policy queda `pending`. Se aprueba desde el dashboard o Telegram, y el cron sin humano **niega por default**.
  - Evaluar `<ApprovalInbox>` de `chipi-react/multisig`, marcado como experimental, con `isAgentProposal`.
- [ ] Gateway de Telegram:
  - comandos `/status`, `/pause`, `/approve <id>` y chat libre con el mismo cerebro;
  - pairing por código;
  - denegación por default.
- [ ] `/api/mcp`: expone `tools.ts` para que Claude Desktop, Claude Code o Hermes manejen tu wallet Vela. Las tools de escritura pasan por el mismo guard.
- [ ] Guardián opcional en el onboarding (`useGuardianRecovery`).
- [ ] "Connect with Chipi" (`starknet-connector`) para que usuarios con wallets externas paguen x402.

### Fase 3: plataforma (después)

- `npm create vela-agent`: copia skills, policy y SOUL, y deja el `.env` listo.
- Skills comunitarias (PRs a `skills/`) y un leaderboard con estrategias públicas.
- Modo privado (`useShield`) para "guardar ganancias".
- Endur (liquid staking de STRK) y Nostra como skills nuevas.
- Tiers y suscripciones pagados vía x402 o `USDC_PAYMASTER`.

---

## 6. Recomendaciones de producto

- **Sacar del core OSS las tiers, el Treasure y los referidos.**
  - Añaden backend sin demostrar nada de Chipi.
  - El Treasure (sorteo con dinero) tiene **riesgo legal** en MX y EE. UU. Si se quiere, debe vivir solo en la versión hosteada y con revisión legal.
  - En el OSS, "tier" = qué skills están activas.
- **Navigator sin IA** (reglas puras) es una skill con `llm: false`: el tick ejecuta la regla sin pagar el think. Así Sailor y Navigator cuestan $0 en IA.
- **Mensaje de seguridad honesto:** "Vela tiene límites, no acceso". La llave de sesión solo puede llamar a los selectores permitidos, hasta N USDC por día, durante 7 días, y la revocas con un toque.

---

## 7. Gaps del SDK de Chipi que conviene cerrar primero

Estos gaps los arregla Chipi, no Vela. Cada uno elimina código de Vela y mejora el tutorial.

| # | Gap | Impacto en Vela | Fix sugerido en SDK |
|---|---|---|---|
| 1 | `useChipiSession` / `supportsSessionKeys` solo aceptan CHIPI | No se puede usar el hook "todo en uno" con el wallet default (SHHH) | Aceptar `"SHHH"` |
| 2 | x402 no tiene wrapper para Next App Router (`x402Middleware` es solo Express) | ~40 LOC propias | `withX402(handler, { amount })` en `@chipi-stack/nextjs/server`, que liquide solo si la respuesta es < 400 (como `@x402/next`) |
| 3 | El facilitator no verifica pagos hechos con sesión (`s: "session"`) | El agente paga y recibe 402 | Verificar on-chain el evento `Transfer` (monto, `payTo`, nonce) |
| 4 | `addSessionKeyToContract` recibe selectores crudos; la skill de ejemplo usa nombres | Bug silencioso (el nuestro) | Aceptar nombres y convertirlos, o validar que sean hex |
| 5 | `useX402Payment`, `useGuardianRecovery` y `<Recover>` no se re-exportan en `nextjs` | Dependencia extra | Re-exportarlos |
| 6 | x402 v1 propietario frente al spec v2 `scheme_exact_starknet` | Menos interoperabilidad con agentes de Coinbase y otros | Publicar `@x402/starknet` upstream en x402-foundation |
| 7 | No hay API de IA en el SDK | `chipi-client.ts` especulativo | Si existe, exponerla como `sdk.ai.*` pagada con x402 |
| 8 | Skills desactualizadas: CHIPI como default, `paywall(req)`, `pip install chipi-x402`, `useStakeVesuUsdc`, `allowedEntrypoints: ["transfer"]` | Los agentes de código (Claude Code) generan código roto | Regenerar las skills desde los `.d.ts` en CI |
| 9 | El export de `@chipi-stack/backend/sku-purchases` apunta a un archivo que no existe | — | Arreglar el `exports` map |
| 10 | La auditoría externa de SHHH V8.4 está pendiente | Tope de depósito en la beta | Terminar la "Phase 13" |

---

## 8. Serie de videos (1 episodio ≈ 1 PR, ≤150 LOC)

| # | Episodio | Chipi / concepto | LOC aprox. |
|---|---|---|---|
| 1 | "Tu wallet con huella": passkey y wallet SHHH gasless | `useCreateWallet({ usePasskey })`, Clerk JWKS | 60 |
| 2 | "Dale al agente una llave con límites" | `createSessionKey`, `addSessionKeyToContract`, selectores | 70 |
| 3 | "Límites on-chain que ni el agente puede romper" | `setSpendingPolicy` / `getSpendingPolicy` | 40 |
| 4 | "Tu primera API que cobra": x402 en Next.js | `createX402Facilitator`, `/api/think` | 50 |
| 5 | "Un agente que paga por pensar" | `X402Client` desde el cron | 40 |
| 6 | "El cerebro": Claude + tools + skills en Markdown | `tools.ts`, `SKILL.md` | 120 |
| 7 | "Cinturón de seguridad": policy guard | `policy.ts` + `policy.json` | 50 |
| 8 | "Ejecuta sin gas": swap en AVNU y yield en Vesu con la sesión | `executeTransactionWithSession`, `waitForTransaction` | 60 |
| 9 | "Memoria y personalidad": SOUL.md + MEMORY.md | — | 60 |
| 10 | "Háblale por Telegram" y aprobaciones humanas | Gateway + pending actions | 120 |
| 11 | "Tu wallet dentro de Claude": servidor MCP | `tools.ts` → MCP | 40 |
| 12 | "Despliega el tuyo en 5 minutos" | Deploy button, `THINK_URL` vs `ANTHROPIC_API_KEY` | — |
| 13 | Bonus: guardianes y recuperación | `useGuardianRecovery` | 60 |
| 14 | Bonus: modo privado | `useShield` | 50 |

---

## 9. Decisiones abiertas

1. **Wallet:** ¿SHHH (recomendado; exige arreglar el gap #1 o usar hooks sueltos) o CHIPI v33?
2. **Auth:** ¿Clerk o el auth que use Chipi internamente?
3. **Cerebro hosteado:** ¿`/api/think` de Vela o una API de IA de Chipi? Si la de Chipi está viva, ¿cuál es su contrato real?
4. **Scheduler:** ¿Vercel Pro cron o QStash? (Afecta a la frecuencia: cada 30 min frente a reaccionar en segundos.)
5. **Tiers y Treasure:** ¿fuera del OSS?
