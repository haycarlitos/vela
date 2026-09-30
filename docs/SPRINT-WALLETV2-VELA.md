# Sprint: mejorar walletv2 y lanzar Vela (sin romper prod)

> 2 semanas, desde el 2026-09-28. Complementa `docs/CHIPI-14X-PLAN.md` (el inventario completo).

**Objetivos del sprint**
1. **walletv2:** simulacro de recuperación aprobado en prod → privacidad encendida en prod.
2. **Vela:** beta pública con tope de depósito (sesiones SHHH + spending policy + x402 + IA de Chipi).
3. **Cero regresiones** en roca-beneficios, walletv2 y los integradores externos que siguen los docs.

**Prioridades acordadas con el usuario**
- `env.txt` y la `sk_prod` del test: repo privado, última prioridad (backlog).
- `by-user` devuelve el `encryptedPrivateKey` **por diseño** (compatibilidad con otras dapps). Solo se registra en logs el acceso a otro usuario; no se bloquea (§4).

---

## 1. Consumidores y qué versión corren (lockfiles)

| Consumidor | `@chipi-stack` | passkey | starknet | Qué usa de Chipi |
|---|---|---|---|---|
| **roca-beneficios** | 14.12.0 | **2.2.0** | 9.4.2 (+ 9.2.1 anidado en backend) | Wallets SHHH con passkey, firma CHIPI y SHHH, guardián propio (builders del SDK + `execute-sponsored-raw`), `useGuardianRecovery`, migración a SHHH, treasury multisig (`sk_`). **Id de usuario `${clerkUserId}#${seq}`** tras un reset |
| **walletv2** | 14.9.0 | 2.3.0 | 9.2.1 | Wallets SHHH con PRF obligatorio, friend recovery (`/guardians/recovery-requests*`), privacidad (`fund-gas`), `/ai/prices` con `pk_` desde el browser, gifts con `sk_`, SKUs |
| **vela** | 14.0.0 | 2.0.0 | 9.2.1 | (a reescribir) |
| **mexicop2p** | n/a | n/a | n/a | **No usa Chipi** (UI Vite de prueba). Si el mexicop2p de prod vive en otro repo, hay que revisarlo antes de desplegar los cambios de backend |
| Terceros | cualquiera 14.x | ^2.x | ≥ 9.2.1 | Lo que dicen los docs (`pk_` en gifts y en IA, `externalUserId` arbitrario) |

---

## 2. Reglas de compatibilidad del sprint

1. **SDK:** los patch son solo fixes; los minor son solo aditivos; **ningún default cambia** en este sprint.
2. **Backend y facilitator:** todo cambio que pueda rechazar un request pasa por **shadow (solo log) → flag por org → enforce**. En este sprint solo se hace shadow, salvo en lo que pierde dinero hoy (P1).
3. Las respuestas nuevas de rechazo son **4xx, nunca 5xx**. walletv2 reintenta los 5xx.
4. **Gate antes de publicar a npm:**
   - `pnpm pack` de los paquetes;
   - instalarlos en ramas de roca-beneficios y walletv2 → `tsc` + `build`;
   - smoke de firma SHHH y CHIPI en staging.
   - Si roca o walletv2 fallan, no se publica.
5. Los cambios en chipi-back pasan por staging primero; se verifican on-chain, no en la UI.

### 2.1 Tres fixes del plan que se rediseñaron porque rompían prod

| ID | Diseño original | Por qué rompía | Diseño del sprint |
|---|---|---|---|
| **X11** | Consumir el nonce en `verify()` | `settle()` llama a `verify()` (`facilitator.ts:242`): **todo settle fallaría** | Consumir solo en la rama `verifyOnly` del middleware (`middleware.ts:207`) o con `verify(p, { consume: true })` opt-in |
| **X1** | Exigir `execute_before ≤ validUntil` | El cliente SHHH honesto firma con `executeBefore ≈ now + 2h` (`shhh/oe.ts:90`) y `validUntil = now + maxTimeout` (`shhh-client.ts:220`): **rechazaría todo pago actual** | Validar llamada, token, selector, `payTo` y monto (lo que protege el dinero). La regla de tiempo: `≤ validUntil + 2h` y **solo log**. El cliente pasa `executeBefore = validUntil` desde 14.13.1 |
| **B13** | `externalUserId == sub` | roca usa `sub#N` tras un reset (`lp-chipi-id.ts:13`): **403 a esos LPs** | Solo log. Si algún día se aplica: aceptar `sub`, `sub#*` o un claim configurable, y dejar pasar `sk_` |

Y un cuarto rediseño:

| ID | Problema | Diseño del sprint |
|---|---|---|
| P1 | chipi-back no tiene registro de companions, así que "companion registrado" no se puede validar | Topes por `sub` y por llave (también para la allowlist) con meter que falla cerrado (429). El endpoint de registro de companion va en coordinación con walletv2, el sprint siguiente |

---

## 3. Plan día por día

### Semana 1

**Día 1–2: deploys de backend (staging → prod)**

| # | Cambio | Repo | Modo | Por qué en este sprint |
|---|---|---|---|---|
| 1 | **P1** topes en `fund-gas` por `sub` y por llave (incluida la allowlist); meter falla cerrado con **429**; P2 sin reintento si la tx pudo haberse enviado | chipi-back | Enforce | Se puede perder dinero hoy y es requisito para encender privacidad |
| 2 | **P3b** reenviar `additional_data` | chipi-back | Enforce | Requisito de privacidad |
| 3 | **G5b** `/sign` responde igual; un worker pasa SIGNING → INITIATED o FAILED según el recibo | chipi-back | Enforce (async) | Requisito del simulacro |
| 4 | **G3** notificar owner y guardianes solo en `friend-recovery.service` (opt-out por org) | chipi-back | Enforce | Requisito del simulacro |
| 5 | **S3 backend** `hash.getSelector` en `paymaster.service.ts:55` (los nombres dan el mismo selector: sin cambio para roca) | chipi-back | Enforce | Requisito de sesiones de Vela |
| 6 | Logs shadow: B1 (gifts con `pk_`), B2 (IA con `pk_` por org), B3 ("se habría rechazado por saldo"), B13 (`externalUserId ≠ sub`) + registrar `pk_` o `sk_` en cada llamada | chipi-back | Solo log | Datos para decidir el enforce del sprint siguiente |
| 7 | **R2** Cartridge al final de la cadena + 410 como transporte; **F1** shadow: registrar si el `Transfer` no cuadra y txHash repetidos | x402-facilitator | Enforce R2 / log F1 | Estabilidad; datos |

**Día 2–3: walletv2 (staging → prod)**
- **G4:** JWT fresco después de la biometría en el approve del amigo.
- **G2:** cancelar desde un dispositivo agregado (`executeAsDevice`) o, como mínimo, mostrar "cancela desde tu dispositivo principal".
- **P9:** cuota de shield por usuario y `/api/privacy/prove` detrás de `reserveShield`.
- **P4-app:** sin fallback a Cartridge para envíos de privacidad.

**Día 3: arrancar el simulacro de recuperación en prod** (el reloj de 7 días empieza aquí)
- Wallet `0x65ea61b4…`; aprueban aida o tabatha desde su dispositivo primario.
- Justo después del approve, comprobar `get_pending_recovery` **on-chain**.
- Probar la cancelación desde el primario en un intento previo; luego initiate definitivo.
- Registrar todos los hashes.

**Día 3–5: SDK 14.13.1** (patch: solo fixes) + `chipi-stack` PyPI + `core` 0.6.1

| Cambio | Compatibilidad |
|---|---|
| S1 decode de `getSessionData` (TS + Py) + `useChipiSession` expirada ≠ revocada | Mismos campos; antes siempre decía "inactiva". Nadie en prod lo usa |
| S3 `normalizeEntrypoints` + `getSelector` (TS + Py) | El hex no cambia; los nombres pasan de roto a correcto |
| S6 resolver de `walletType` solo si se omite | Si se pasa explícito, no cambia |
| PF1 conservar `code` y `cause` **y el prefijo del mensaje** | No cambia el texto que alguien pudiera parsear |
| PK5 `starknet ^9.2.1 <10` | roca deduplica a 9.4.2 (correr el smoke de hash OE en 9.4) |
| X1 validador (llamada, token, selector, `payTo`, monto) + cliente con `executeBefore = validUntil`; regla de tiempo solo log | Los pagos honestos pasan |
| X11 consumir el nonce en `verifyOnly` del middleware; tope de `validUntil`; clave `from:nonce` solo en memoria | `settle()` no cambia |
| X2 solo warning | Sin cambio de comportamiento |
| P4, P5, P6, P11 (core privacy), R1 (RPC de Python) | Fixes |
| CI: publint + attw + exports contra el tarball | n/a |

**Gate:** tarballs instalados en roca y walletv2 → build verde; smoke SHHH de sesión en mainnet con fondos mínimos (registrar con nombres → `isActive: true` → ejecutar dentro del tope → fuera del tope detectado).

### Semana 2

**Día 6–8: SDK 14.14.0 (minor, aditivo)**

| Cambio | Para quién |
|---|---|
| S2 SHHH en `useChipiSession` y `supportsSessionKeys` (**requiere S1 y S3**, ya publicados) | Vela, walletv2 "pagos rápidos" |
| NB1a `getEncryptKey` / `usePasskey` en `useChipiSession` + builders puros (`buildAddSessionKeyCall`, `buildSetSpendingPolicyCall`, `buildSessionSetupCalls`) | Vela, walletv2 |
| S1 campos nuevos `maxCalls` / `callsUsed`; S4 `{ supported }` | Vela, walletv2 |
| NB3 `sdk.ai` (solo `sk_`) + tipos `ThinkDecision` reales (**D4:** docs con el enum correcto) | Vela |
| `SessionTxVerifier` opt-in (evento `Transfer` + store de txHash inyectable) - **sin** cambiar el default de X2 | Vela (verifica sus propios cobros x402) |
| PK3 / NB9 re-exports (`useX402Payment`, `useGuardianRecovery`, `PrfUnsupportedError`…) | Todos |
| G1 `<Recover>` con `expiresAt` opcional | Todos |

Mismo gate que en 14.13.1.

**Día 6–10: Vela beta** (en paralelo, sobre 14.14.0)
- `lib/session.ts` → `executeTransactionWithSession`.
- Sesión creada en el server + registro y policy firmados con passkey (NB1a).
- Cerebro sobre `sdk.ai` (`signals` → `think`) + `policy.ts`.
- `/api/think` con x402 verificado por `SessionTxVerifier` (**no depende del facilitator hosteado**).
- Onboarding: Clerk + passkey PRF + SHHH.
- Fondear la org de Vela (evita el 402 cuando B3 se active).
- Beta con tope de depósito de $100 por wallet.

**Día 10: walletv2, encender privacidad** (si el simulacro finalizó y se cumplen los gates)
- [ ] Simulacro: finalize exitoso, verificado on-chain.
- [ ] P1, P3b, P9 y P4-app en prod.
- [ ] **P7:** divulgar el relay de Starkscan.
- [ ] Mostrar en la UI que los fondos shieldeados no se recuperan con guardianes (P8).
- [ ] `NEXT_PUBLIC_PRIVACY_ENABLED=true` en staging → 24 h → prod.

**Opcional si sobra tiempo:** walletv2 "Pagos rápidos" reales (reemplazar el mock de `lib/services/sessions.ts` con 14.14.0), detrás de `SESSIONS_ENABLED`.

**Día 10: revisión de los logs shadow** → decidir el enforce del sprint siguiente (B1, B2, B3, F1), con la lista de orgs afectadas y un aviso previo a cada una.

**Docs en el sprint** (baratos, bajan tickets):
- D1: sesiones (SHHH, selectores);
- D4: AI API (enum, `sk_`);
- D7: gifts (aviso de que `pk_` se va a deprecar);
- nota del CHANGELOG ("SHHH no tiene session keys").

---

## 4. Fuera del sprint (backlog priorizado)

1. **Enforce** de B1, B2, B3 y F1 según los logs (sprint 2), con deprecación anunciada.
2. X3/X5/`withX402`/F3/x402 v2 → 14.15.0.
3. Guardianes al SDK (NB5), `useSessionSetup` → 14.16.0.
4. B6 (JWKS `kid`), B8 (hash de `sk_`), B9 (timestamp de webhooks), B7, S5b.
5. B13: decidir con los logs. El `encryptedPrivateKey` es seguro solo si el `encryptKey` tiene alta entropía (PRF de passkey sí; un PIN de 4–6 dígitos no). Evaluar cuántas wallets de PIN hay antes de decidir.
6. Registro de companions de privacidad (P1 completo) con walletv2.
7. Última prioridad: `env.txt`, `sk_prod` en test, MCP cert, higiene de releases.

## 5. Recomendaciones a consumidores (no bloquean el sprint)

- **roca-beneficios:**
  - Con passkey 2.2.0, un dispositivo **sin PRF crea wallets custodiales en silencio**: cae a PBKDF2 y la doble derivación pasa igual (`wallet-form.tsx:171-232`). Subir a 2.3.0 y mapear `err.code === "PRF_UNSUPPORTED"` a la pantalla `SIN_PRF` (hoy ningún regex lo atrapa, `wallet-form.tsx:248-285`).
  - Actualizar REVIEW.md: las wallets ya se crean como SHHH.
- **walletv2:** planear el registro de companions (P1) y una org de prueba para los gifts en staging (B1 enforce futuro).
- **mexicop2p:** confirmar dónde vive el código de prod que usa Chipi, si existe.

## 6. Riesgos del sprint

| Riesgo | Mitigación |
|---|---|
| El simulacro no finaliza a tiempo (7 días) | Arrancarlo el día 3 como máximo. Si se retrasa, la privacidad pasa al sprint siguiente sin bloquear Vela |
| Un patch del SDK rompe a roca o walletv2 | Gate de tarball + build en ambos repos antes de publicar |
| Los logs shadow muestran uso de `pk_` en gifts o IA por terceros | No se hace enforce; se contacta a cada org antes |
| Vela depende de x402 hosteado (F1) | Vela verifica sus propios cobros con `SessionTxVerifier` |
