# Chipi: diagnóstico y plan de release 14.x

> Fecha: 2026-09-27.
>
> Análisis de solo lectura sobre:
> - `chipi-pay/sdks` @ `8c0b4ab` (14.13.0);
> - `chipi-pay/chipi-back` @ `5949fcc`;
> - `chipi-pay/x402-facilitator` @ `557f3ae`;
> - `haycarlitos/walletv2` @ `db6379ca`;
> - docs.chipipay.com (`llms-full.txt`);
> - `chipi-pay/skills`;
> - los contratos `sessions-smart-contract` v33 y `shhh-wallet-cairo` V8.4.
>
> **No se modificó ningún repo de Chipi.** Este documento vive solo en Vela.
>
> Regla del release: **todo compatible con 14.x.** Nada rompe la API pública: los cambios son aditivos, opt-in o con deprecación y warning.

---

## 0. Resumen ejecutivo

- **52 hallazgos.**

  | Tipo | Cuántos | Dónde se arregla |
  |---|---|---|
  | Bugs de backend | 15 | 13 en chipi-back, 2 en x402-facilitator; deploy, no SDK |
  | Bugs del SDK | 19 | Release npm |
  | Código no hecho o a medias | 9 | Release npm o backend |
  | Solo docs/skills | 6 | Sin release |
  | Infra/ops | 3 | Ops |

- **7 son P0 de seguridad, y ninguno requiere release del SDK para mitigarse:**
  - 5 están en el backend o en el facilitator hosteado;
  - 2 están en el `X402Facilitator` del SDK; los integradores lo mitigan con `provider` + verificación del `Transfer` mientras sale el patch.
- **Tres cosas "no funcionan" hoy aunque la documentación diga que sí:**
  1. sesiones vía `useChipiSession` (bug S1 + gate CHIPI-only);
  2. liquidación x402 para wallets CHIPI/READY (bug de diseño X3);
  3. x402 pagado con sesión (X4).
- Las ramas `fix/x402-session-txhash` y `feat/x402-sugar-layer` **ya están en main**: se pueden borrar.

**Propuesta de releases:**

| Ola | Qué | Tipo | Cuándo |
|---|---|---|---|
| **0** | Hotfixes de seguridad en backend y facilitator hosteado | Deploy | **Hoy** |
| **1** | **14.13.1**: bugs del SDK sin cambiar API + packaging + CI de exports | Patch (grupo fixed) | Esta semana |
| **2** | **14.14.0**: sesiones SHHH, x402 que liquida de verdad, `withX402` para Next, `sdk.ai`, `<Recover>` expired | Minor | 2–3 semanas |
| **3** | **14.15.0**: guardianes en el SDK (desde walletv2), `useSessionSetup`, verificador x402 compartido, x402 v2 | Minor | Después |
| Paralelo | Barrido de docs y skills | Sin release | Desde ya |

---

## 1. Clasificación completa

Leyenda:
- **Tipo:** BACK = bug de chipi-back · FAC = bug del facilitator hosteado · SDK = bug en el SDK · NB = no construido · PART = construido a medias · DOCS = solo docs o skills · OPS = infraestructura.
- **Sev:** P0 seguridad · P1 roto para usuarios · P2 DX o gap · P3 cosmético.
- **Ola:** en qué release se arregla.

### 1.1 Seguridad (P0)

| ID | Hallazgo | Tipo | Evidencia | Ola |
|---|---|---|---|---|
| **B1** | **Una llave `pk_` (incluida la `pk_dev_` que se crea sola al registrarse) crea gifts y los cobra como USDC real de mainnet.** Las llaves DEV y las orgs `creditsExempt` se saltan el hold, pero el redeem sí manda fondos (`sendCardFunds`) desde `MANAGER_PRIVATE_KEY`. Topes `null` por default. walletv2 expone un `pk_prod` en el bundle | BACK | `gifts.controller.ts:153-236`, `gifts.service.ts:70-94,632`, `schema.prisma:160-161`, PR #390 | 0 |
| **B2** | Las rutas `/v1/ai/*` aceptan `x-api-key: pk_` (llave pública). Cualquiera gasta los créditos de IA de la org con cualquiera de 8 modelos. Sin límite por org (`RateLimitGuard` no se aplica). Los docs recomiendan usar `pk_` en el browser | BACK + DOCS | `api-key.guard.ts:40`, `ai.controller.ts:192-670`, `quickstart.mdx:129` | 0 / 2 |
| **B3** | El cobro de IA se hace **después** de llamar al proveedor, y si falla el error se traga. Con $0.01 de saldo hay llamadas ilimitadas. Stream y signals tienen el mismo problema | BACK | `ai.controller.ts:809,871-879`, `treasury.service.ts:323`, `prices.controller.ts:350` | 0 |
| **B4** | JWKS con `iss`/`aud` opcionales. Firebase comparte llaves entre proyectos, así que una org con Firebase sin regla `aud` permite **suplantar cualquier `externalUserId`** con un token de otro proyecto | BACK | `bearer-token.guard.ts:249-250`, `create-jwks.dto.ts:74-78` | 0 (auditar) → 2 |
| **F1** | **El facilitator hosteado acepta como "pago de sesión" cualquier tx exitosa de mainnet.** No verifica el `Transfer` (from/to/monto/token). Acepta txs pendientes. El nonce lo elige el cliente, así que el mismo txHash sirve infinitas veces | FAC | `x402-facilitator/src/lib/facilitator.ts:86-96,137-142`, `signature.ts:121-143` (verificado) | 0 |
| **X1** | El `X402Facilitator` del SDK no valida que el `oeCalldata` SHHH pague el monto, al `payTo` y en el asset correctos. Reenvía calldata arbitraria usando el patrocinio de gas del merchant | SDK | `backend/src/x402/facilitator.ts:170-181,265-275` | 1 |
| **X2** | Sin `provider`, la verificación de firma es solo de presencia (es el default). Con `verifyOnly`, un `{r:"0x1", s:"session"}` falso pasa | SDK | `facilitator.ts:183-189`, `chipi-sdk.ts:141-144` | 1 |

### 1.2 Backend y facilitator (deploys, no SDK)

| ID | Hallazgo | Tipo | Sev | Ola |
|---|---|---|---|---|
| B5 | Rate limiter por modelo **global**, compartido entre todas las orgs: `gemini-pro` queda en 1 RPM para todos. Una `pk_` filtrada bloquea a todos los clientes | BACK | P1 | 0 |
| B6 | JWKS sin `kid`: cualquier rotación del proveedor causa un outage. `JwksClient` se crea por request (sin cache). No se revisa `isActive`/`expiresAt` en el camino JWT. El mensaje de error repite el `pk_` | BACK | P1 | 2 |
| B7 | Con `pk_` y sin firma se crea una recuperación de treasury que **cancela las pendientes**, y el `oeHash` no se recalcula en el server | BACK | P1 | 0 |
| B8 | `sk_` guardadas en texto plano. Sin rotación. `validateApiKey` ignora `expiresAt` | BACK | P1 | 2 |
| B9 | Webhooks firmados sin timestamp, así que se pueden repetir | BACK | P2 | 2 |
| B10 | `POST /v1/blockchains/verify-sku-recharge-transaction` sin auth: vector de DoS y de gasto de cuota de CoinGecko | BACK | P2 | 0 |
| B11 | Llave de Infura hardcodeada (`rpc-chain.ts:66`). `enableDebugMessages` activo en prod | BACK | P3 | 2 |
| B12 | `/v1/ai/think` no valida la decisión; si falla el parseo devuelve `{raw}` | BACK | P1 | 2 |
| F2 | Facilitator hosteado: `/api/verify` y `/api/settle` sin auth y con CORS `*`. `settle` gasta el patrocinio de gas del facilitator. No recibe `paymentRequirements`. No tiene rama SHHH | FAC | P1 | 0 / 2 |
| S5b | Un gasto por encima del tope se reporta como **SUCCEEDED** sin evento `Transfer`. chipi-back solo lo registra en logs (`[phantom-check]`) | BACK | P1 | 2 |

### 1.3 Bugs del SDK

| ID | Hallazgo | Evidencia | Sev | Arreglo compatible con 14.x | Ola |
|---|---|---|---|---|---|
| **S1** | **`getSessionData` decodifica mal.** Lee `[is_active, valid_until, remaining, len]`; el contrato devuelve `{valid_until, max_calls, calls_used, len}`. Toda sesión aparece inactiva, `useChipiSession` la marca "revoked" y `executeWithSession` lanza error. Los tests mockean la forma inventada. Python tiene el mismo bug | `backend/src/sessions.ts:405-409`, `interface.cairo:9-14` (verificado) | P1 | Decodificar el struct real y calcular `isActive`/`remainingCalls`. Campos nuevos opcionales: `maxCalls`, `callsUsed` | 1 |
| **S2** | `useChipiSession` y `supportsSessionKeys` solo aceptan CHIPI, pero SHHH es el default y el backend ya lo soporta | `useChipiSession.ts:213`, `useChipiWallet.ts:231` | P1 | Aceptar SHHH con signer STARK o ED25519. Nuevo `supportsSpendingPolicies` | 2 |
| **S3** | `allowedEntrypoints` se pasa crudo. En CHIPI, `"transfer"` se vuelve un short-string: el registro "funciona" pero **toda llamada falla** después. En SHHH lanza error. Además la whitelist no está limitada por contrato | `sessions.ts:223`, `paymaster.service.ts:57` | P1 | `normalizeEntrypoints` (nombre → selector; el hex no cambia) + `hash.getSelector` en `execute-paymaster-raw.ts:112`, `snip12-hash.ts:90` y chipi-back `paymaster.service.ts:55` | 1 |
| S4 | Wallets CHIPI v29 (el default de CHIPI) no tienen spending policies. `getSpendingPolicy` oculta el error y devuelve ceros. `maxPerWindow=0` significa **ilimitado**. Los docstrings dicen "CHIPI v29 o SHHH" | `sessions.ts:564,632,797-822,839` | P1 | Warnings + `{supported:false}` + corregir los docstrings | 1 |
| S6 | Un `walletType` omitido se trata distinto según el método: execute lo vuelve CHIPI (enruta mal SHHH), add/revoke lanzan error, `setSpendingPolicy` lo resuelve on-chain | `sessions.ts:64,530,671` | P2 | Usar en todos el resolver por class hash | 1 |
| S8 | En SHHH, `saveToDatabase:false` se ignora en las operaciones admin. Un `validUntil` distinto al de la sesión rompe todas las ejecuciones | `execute-paymaster-raw.ts` | P3 | Pasar el flag; warning ante el mismatch | 1 |
| **X3** | **La liquidación x402 de CHIPI/READY no puede funcionar** (ni en el SDK ni en el facilitator hosteado). El cliente firma el typed data `Payment`, pero `settle` envía esa firma como si fuera de otro OE. On-chain se rechaza. Ningún test liquida de verdad | `core/src/x402/client.ts:292`, `facilitator.ts:302-321`, `x402-facilitator/src/lib/paymaster.ts:244` | P1 | Modo opt-in `payload.oe` (el comprador firma el OE, como SHHH). `{r,s}` queda deprecated con error claro | 2 |
| **X4** | x402 pagado con sesión: el facilitator del SDK no tiene esa rama (el comprador **ya pagó** y recibe 402). No hay cliente Node que pague con sesión (`X402ShhhClient` usa la llave del owner). El hook no espera la inclusión | `facilitator.ts`, `shhh-client.ts:249`, `useX402Payment.ts:261-275` | P1 | `SessionTxVerifier` (evento `Transfer` + unicidad) y `X402SessionClient` | 2 |
| X5 | `useX402Payment` no puede pagar desde SHHH (el default): firma `{r,s}` sin extensión `shhh` | `useX402Payment.ts:293-324` | P1 | Rama SHHH reutilizando la lógica de `X402ShhhClient` | 2 |
| X6 | `x402Middleware` liquida **antes** de correr el handler, así que se cobra aunque el handler falle | `middleware.ts:193-219` | P2 | Opción `settle: "after-success"` (default igual que hoy) + header `X-PAYMENT-RESPONSE` | 2 |
| X11 | Nonce store en memoria sin límite y no ligado al pagador | `facilitator.ts:18-30` | P3 | Clave `from:nonce` + TTL + warning en prod | 1 |
| G1 | `<Recover>` ofrece "ejecutar" una operación **expirada**, que revierte. Es el mismo bug que walletv2 arregló en #268/#219 | `Recover.tsx:41-45,95-104` | P1 | `pendingOp.expiresAt` opcional + fase `"expired"` | 2 |
| G5 | `TIMELOCK_SECONDS.ADD_GUARDIAN = 86_400` dice 24 h, pero agregar un guardián tarda 48 h (`propose_add_owner`) | `shhh/recovery.ts:82` | P3 | `@deprecated` en el JSDoc | 1 |
| PK1 | `@chipi-stack/backend/sku-purchases` apunta a un archivo que no existe (confirmado en el tarball) | `tsup.config.ts:8` | P1 | Renombrar la entry + alias | 1 |
| PK2 | `@chipi-stack/chipi-react/components` apunta a archivos que no existen | `chipi-react/tsup.config.ts` | P2 | Agregar `src/components.ts` (`Recover`, `ChipiInjector`) | 1 |
| PK3 | nextjs no re-exporta `useX402Payment`, `useGuardianRecovery`, `useShhhSigner`, `useThresholdSign`, `useMigrateWalletToShhh`, `useGetSkuPurchase`, `Recover` ni las clases de error, aunque los docs las importan de ahí | `nextjs/src/hooks.ts` | P2 | Re-exportar | 1 |
| PK5 | backend fija `starknet: "9.2.1"` exacto (puede duplicar starknet en la app). Condiciones de types (`.d.ts` vs `.d.mts`) | `backend/package.json` | P3 | `^9.2.1`; corregir las condiciones | 1 |

### 1.4 No construido o a medias

| ID | Qué falta | Tipo | Sev | Ola |
|---|---|---|---|---|
| NB1 | Hook o builders para spending policies con passkey, sin mandar el `encryptKey` al server. Hoy solo existen dentro de `useChipiSession`, sin passkey | PART | P2 | 2 (builders + `getEncryptKey`) / 3 (`useSessionSetup`) |
| NB2 | `withX402` para Next App Router y un `processX402Request` agnóstico al framework | NB | P2 | 2 |
| NB3 | `sdk.ai` en `@chipi-stack/backend` (solo `sk_`): chat, stream, think, execute, prices, signals, usage | NB | P2 | 2 |
| NB4 | Pago x402 para `/v1/ai/*` (agentes sin cuenta) | NB | P2 | 3 |
| NB5 | Orquestación de guardianes en el SDK: lectores de chain (`readPendingOp`/`readPendingRecovery`/`readOwners` con `withRpcFallback`), `isOpExpired`, `executeShhhSponsoredRawWithSigner`, `relayFinalizeRecovery`, cliente `ChipiGuardians` (`/v1/guardians/*`) y `useRecoveryService`. Hoy todo vive en walletv2 (~2,3k LOC) | NB | P2 | 3 |
| NB6 | Guardián tipo C (passkey por email) **sin flujo de recovery**, aunque los docs lo anuncian. GaaS (tipo D): el signer no está desplegado (`GAAS_SIGNER_URL`) | NB + OPS | P2 | 3 |
| NB7 | Un solo verificador x402. Hoy hay 3 implementaciones distintas: SDK (SHHH, sin sesión), hosteado (sesión, sin SHHH) y Python (ninguna) | NB | P2 | 3 |
| NB8 | Compatibilidad con x402 estándar: header base64, `accepts[]`, CAIP-2 `starknet:SN_MAIN`, v2. Se puede agregar sin romper v1 | NB | P2 | 3 |
| NB9 | Paridad de chipi-expo: faltan `useGuardianRecovery`, `useX402Payment`, `useShhhSigner`, `useThresholdSign`, privacy… | NB | P2 | 2 |

### 1.5 Solo docs y skills (sin release)

| ID | Qué está mal | Sev |
|---|---|---|
| D1 | **Sesiones:** ~15 páginas dicen "solo CHIPI". El CHANGELOG 14.13 dice "SHHH no tiene session keys". `spending-policies.mdx` dice "solo v33". `multisig-governance.mdx:650` dice "próximamente". Los ejemplos usan nombres en vez de selectores (`x402-sessions.mdx:53,85,131,186`, `spending-policies.mdx:128`). Guía contradictoria sobre guardar sesiones en el server (`gasless/sessions.mdx` además cifra con el PIN del usuario) | P1 |
| D2 | **Recovery** (`recovery.mdx`): el hook `useChainState` es ficticio; finalize va por el camino firmado por el owner en vez de `/transactions/finalize-recovery`; el tipo C se anuncia como funcional; no avisa del JWT que expira durante la biometría (walletv2 #233) | P1 |
| D3 | **Skills:** hooks que no existen (`useStakeVesuUsdc`), `pip install chipi-x402` (404), `chipi-python` en vez de `chipi-stack`, CHIPI como default, **19 archivos usan `NEXT_PUBLIC_CHIPI_API_KEY` como bearer** (da 401), `paywall(req)` | P1 |
| D4 | **AI API:** el enum de `/think` en los docs (`hold/buy/sell`) no coincide con el código (`swap/supply/withdraw/hold`); `/execute` solo sirve para `swap`; los docs recomiendan `pk_` en el browser | P1 |
| D5 | x402: el hook "hace fallback" cuando la sesión expiró (no es cierto); la sesión en Node se firma con `X402Client` (no funciona); los CHANGELOGs dicen "session txHash support"; `x402-shhh-buyers` dice que el facilitator lo maneja "as-is" | P2 |
| D6 | Imports desde nextjs que no existen (error-handling, x402-sessions). Expo `useBiometrics` no existe. `wallet.wallet` en el README de backend y en `python/transfer.mdx`. El README de GaaS está desactualizado. Las release notes paran en 14.7 | P2 |

### 1.6 Infra y ops

| ID | Qué | Sev |
|---|---|---|
| O1 | El certificado de `mcp.chipipay.com` venció el 18 de abril de 2026 (proyecto de Vercel con el auto-renew roto). Además los docs dicen "registry de componentes" y el README de skills dice "servidor MCP" | P1 |
| O2 | El CI no corre publint, attw, chequeo de exports ni `docs:check` (existe, pero cubre 6 archivos y no está en ningún workflow). Por eso salieron PK1 y PK2. Los smokes SHHH solo corren a mano | P2 |
| O3 | Higiene de releases: `HOW_TO_RELEASE.md` describe publicar desde laptop (el CI publica); la rama `staging` está muerta desde mayo; `feat/release-smokes` sin mergear; `build-with-chipi/CHANGELOG` atorado en "14.12.1 unreleased"; ramas x402 obsoletas | P3 |

### 1.7 No son bugs (o ya están resueltos)

- Usar `pk_` como bearer en `useChipiWallet` da 401: el camino JWT rechaza el `pk_`, no es un hueco. Es solo un error de las skills y de Vela (D3).
- CORS `*`: no hay auth por cookies, así que no es un bug por sí solo; empeora B2, pero se mitiga con B2.
- `fix/x402-session-txhash` y `feat/x402-sugar-layer` ya están en main (#335, #139). Solo hay que borrarlas.
- La auditoría externa de SHHH V8.4 está pendiente. No es un bug: es bloqueante para anunciar guardianes, threshold y sesiones SHHH.

---

## 2. Plan por olas

### Ola 0: hotfixes (hoy; deploys, sin release npm)

**chipi-back**

1. **B1, gifts:**
   - exigir `sk_` en todas las rutas de gifts (walletv2 ya usa `sk_` en `server/chipi/gifts.ts`);
   - con llaves DEV, **nunca** hacer el envío on-chain; devolver una tx sintética;
   - orgs exentas o sin `OrgBalance`: `giftMaxValuePerCode` y `giftMonthlyCapUsd` obligatorios, con default no nulo;
   - **auditar los `GiftRedeem` desde el 2026-07-22 (#390)** hechos con llaves DEV o de orgs exentas.
2. **B3:** hold por el peor caso **antes** de llamar al proveedor; liquidar el costo real después o liberar el hold si falla; nunca tragar el error de cobro.
3. **B2 (fase 0) y B5:**
   - límite por org en Redis sobre `ai:*` y tope de gasto diario, más estricto si la llamada viene con `pk_` (p. ej. 20 req/min y $5/día);
   - `sk_` obligatoria en `/ai/usage`;
   - headers `Deprecation` + `Warning` en respuestas de IA pedidas con `pk_`;
   - las orgs exentas también llevan tope.
4. **B7:** crear una recuperación de treasury requiere `sk_` o la firma de un owner o guardián; recalcular el `oeHash` en el server; no cancelar las pendientes.
5. **B10:** guard + límite en `verify-sku-recharge-transaction`.
6. **B4:** consultar en la DB las configs FIREBASE/GENERIC sin regla `aud`/`iss`, avisar a esas orgs y registrar en logs los tokens que fallarían.

**x402-facilitator**

7. **F1:** en pagos de sesión, exigir en el recibo:
   - un evento `Transfer` del USDC con `from == fromAddress`, `to == toAddress` y `value >= amount`;
   - finalidad `ACCEPTED_ON_L2`;
   - **`tx_hash` UNIQUE** (un txHash, un pago);
   - reintentos con backoff si la tx aún no aparece.
8. **F2 (parcial):** aceptar `paymentRequirements` opcional y hacerlo cumplir; agregar rate limit.

**Ops**

9. **O1:** re-conectar el dominio en Vercel y renovar el certificado.

**Criterio de salida:** tests de regresión para cada caso: `pk_` a `/gifts` → 401; un redeem DEV no llama a `sendCardFunds`; una org con $0.01 recibe 402 antes de llamar al proveedor; un txHash repetido o ajeno se rechaza.

### Ola 1: **14.13.1** (patch del grupo fixed; más `chipi-stack` en PyPI)

Todo es corrección sin cambio de API:

| Cambio | Paquetes y archivos |
|---|---|
| S1 decode de `getSessionData` (TS + Python) + campos opcionales `maxCalls`/`callsUsed` | `backend/src/sessions.ts`, `python/chipi_sdk/sessions.py`, `types` |
| S3 `normalizeEntrypoints` + `hash.getSelector` | `backend/src/sessions.ts`, `shhh/execute-paymaster-raw.ts`, `snip12-hash.ts` (+ deploy de chipi-back `paymaster.service.ts:55`) |
| S4 warnings de v29, `maxPerWindow=0` y `maxPerCall=0`; docstrings | `sessions.ts` |
| S6 resolver de `walletType` en todos los métodos de sesión | `sessions.ts`, `execute-paymaster-transaction.ts` |
| S8 `saveToDatabase` en SHHH + warning por `validUntil` | `shhh/execute-paymaster-raw.ts` |
| **X1 validador del `oeCalldata` SHHH** (1 llamada, USDC, `transfer`, `[payTo, low, high]`, `execute_before`) | `backend/src/x402/facilitator.ts` + nuevo `shhh/parse-oe-calldata.ts` |
| **X2** `provider` de mainnet por default; `verifyOnly` sin `provider` → inválido; opt-out `allowPresenceOnlySignatures` | `facilitator.ts`, `chipi-sdk.ts` |
| X11 nonce store `from:nonce` + TTL | `facilitator.ts` |
| PK1 `sku-purchases`, PK2 `components`, PK3 re-exports en nextjs, NB9 re-exports en expo, PK5 `starknet ^9.2.1` | `tsup.config.ts`, `package.json`, `nextjs/src/hooks.ts`, `chipi-expo/src/index.ts` |
| G5 `@deprecated ADD_GUARDIAN` | `shhh/recovery.ts` (+ Python) |
| **O2** agregar publint + attw + chequeo de exports contra el tarball + `docs:check` al `ci.yml` | `.github/workflows/ci.yml` |
| CHANGELOG: corregir "SHHH no tiene session keys" | `*/CHANGELOG.md` |

- Nota de semver: X2 cambia el comportamiento por seguridad (antes aceptaba firmas sin verificar). Tiene opt-out explícito, así que es aceptable como patch y se documenta en el changelog.
- **Criterio de salida:**
  - smoke de mainnet `shhh-session-smoke` con `getSessionData` → `isActive: true`;
  - tests de manipulación del calldata SHHH (monto, `payTo`, asset, llamada extra);
  - los exports resuelven en el tarball empaquetado.

### Ola 2: **14.14.0** (minor)

Es el release que deja **sesiones + x402 + IA funcionando de punta a punta**. Es lo que necesita Vela.

**Sesiones**
- S2: SHHH en `useChipiSession`/`useChipiWallet` + `supportsSpendingPolicies`.
- NB1a: `getEncryptKey?` y `usePasskey?` en `useChipiSession` (el `encryptKey` nunca sale del browser).
- Builders puros exportados: `buildAddSessionKeyCall`, `buildSetSpendingPolicyCall`, `buildSessionSetupCalls`…
- S5b: helper `waitForTransaction({ expectTransfer })` o `verifyTransfer` para detectar las "falsas SUCCEEDED" (+ que chipi-back marque FAILED).

**x402**
- X3/X4: modo `payload.oe` (el comprador o la **sesión** firma el OE; una sola ruta para CHIPI, READY, SHHH y sesión), `X402SessionClient` para Node, `SessionTxVerifier` para el formato legacy `s:"session"`.
- X5: SHHH en `useX402Payment`.
- NB2/X6: `processX402Request` agnóstico + `withX402(handler, cfg)` para Next (subpath `@chipi-stack/x402/next` o `nextjs/server`) + `settle: "after-success"` opt-in; `x402Middleware` pasa a usar el mismo núcleo.

**IA**
- NB3: `sdk.ai` en backend + tipos `ThinkDecision` (enum real) en `types`.

**Guardianes**
- G1: `<Recover>` con `expiresAt` y fase `expired`.

**Backend en paralelo** (deploy)
- B2 fase 1: migración `ApiKey.allowPublicAi` (default false; se mantiene en true para quien lo usó en los últimos 90 días) y aplicar `allowedOrigins`.
- B6 JWKS por `kid` + cache + `isActive`.
- B8 hash de `sk_` + rotación.
- B9 timestamp en webhooks.
- B12 validación de `/think` + `decision.executable`.
- F2: rama SHHH en el hosteado usando el validador de X1.

**Criterio de salida** (smokes de mainnet en el gate del release):
1. SHHH: crear sesión → registrar con selectores → policy USDC → ejecutar dentro del tope ✅ → ejecutar fuera del tope → detectado como fallo.
2. x402: pago con CHIPI (`payload.oe`), SHHH y sesión contra `withX402` en una app Next → liquidado y `Transfer` verificado.
3. `sdk.ai.think` con `sk_`.

### Ola 3: **14.15.0** (minor)

- **NB5, guardianes en el SDK:** subir de walletv2 los lectores de chain, `isOpExpired`, `executeShhhSponsoredRawWithSigner`, `relayFinalizeRecovery`, `ChipiGuardians` y `useRecoveryService` (con `getBearerToken` inyectable; resuelve el problema del JWT). Después, walletv2 migra a esto y borra ~2k LOC.
- NB1b: `useSessionSetup` (registro + N policies en un solo OE, un solo Face ID; signer enchufable P-256/EIP-191) + `submitSignedOutsideExecution`.
- NB7: `verifyPayment` compartido en `@chipi-stack/x402`, adoptado por el facilitator hosteado y Python.
- NB8: headers v1/v2 duales, base64, alias CAIP-2.
- NB4: pago x402 en `/v1/ai/*` (backend).

**Para quitarle el flag a los guardianes** (en walletv2 y en Chipi):
- correr el ciclo completo en mainnet con los hashes registrados (propose → 48 h → execute → initiate → 7 d → finalize, más cancel);
- tipo C implementado u oculto;
- GaaS desplegado u oculto;
- auditoría de SHHH cerrada.

### En paralelo: docs y skills (sin release; se puede empezar hoy)

1. D1 sesiones + D4 AI API (enum real, solo `sk_`) + D2 recovery.
2. D3 skills: SHHH como default, selectores, JWT en vez de `pk_`, quitar los hooks y paquetes que no existen. Agregar un chequeo en CI equivalente a `docs:check`.
3. D5, D6 y las release notes de 14.8 a 14.13.
4. O3: reescribir `HOW_TO_RELEASE.md`; borrar `staging`, `fix/x402-session-txhash` y `feat/x402-sugar-layer`; decidir sobre `feat/release-smokes`; arreglar el CHANGELOG de build-with-chipi.

---

## 3. Dependencias

```
S1 ──► S2 ──► NB1 ──► useSessionSetup (14.15)
S3 ──► X4 (el pago con sesión necesita selectores bien)
X1 ──► F2 (rama SHHH del hosteado) ──► NB7
X1 + X3 ──► NB8 (v2 = OE firmado por el comprador)
B2 fase 0 ──► NB3 (sdk.ai da el camino sk_ para migrar) ──► B2 fase 2 (apagar pk_ tras 60 días)
G1 ──► NB5 ──► walletv2 migra ──► quitar el flag de guardianes
O2 (CI de exports) antes de 14.13.1, para no repetir PK1/PK2
```

## 4. Coordinación con la otra sesión (evitar colisiones)

- Esta sesión **no escribió nada** en sdks, chipi-back, walletv2 ni x402-facilitator.
- Archivos "calientes" por ola, para repartir el trabajo:
  - **Ola 0:** chipi-back `src/gifts/*`, `src/ai/ai.controller.ts`, `src/treasury/treasury.service.ts`, `src/organizations/treasury-recovery.service.ts`, `src/blockchains/blockchains.controller.ts`; x402-facilitator `src/lib/{facilitator,signature,nonce-store}.ts`.
  - **Ola 1:** sdks `backend/src/{sessions.ts, x402/facilitator.ts, shhh/*}`, `python/chipi_sdk/sessions.py`, `*/tsup.config.ts`, `*/package.json`, `nextjs/src/hooks.ts`, `chipi-expo/src/index.ts`, `.github/workflows/ci.yml`; chipi-back `paymaster.service.ts`.
  - **Ola 2:** sdks `chipi-react/src/hooks/{useChipiSession,useChipiWallet,useX402Payment}.ts`, `chipi-react/src/routes/Recover.tsx`, `core/src/x402/*`, `backend/src/{ai.ts (nuevo), x402/*}`; chipi-back `src/auth/*`, `src/api-keys/*`, `prisma/schema.prisma`.
- Cada ola del SDK es **un changeset** del grupo fixed. `core`, `chipi-passkey` y `starknet-connector` llevan su propio changeset si se tocan (X3 toca `core`).
