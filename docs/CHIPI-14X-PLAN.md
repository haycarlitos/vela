# Chipi: diagnóstico y plan de release 14.x (v2, auditado)

> Fecha: 2026-09-27.
>
> Repos revisados, con los HEAD de ese día:
> - `chipi-pay/sdks` @ `8c0b4ab` (14.13.0);
> - `chipi-pay/chipi-back` @ `5949fcc`;
> - `chipi-pay/x402-facilitator` @ `557f3ae`;
> - `haycarlitos/walletv2` @ `db6379ca`.
>
> Otras fuentes: docs.chipipay.com (`llms-full.txt`), `chipi-pay/skills`, los contratos `sessions-smart-contract` v29/v33 (ABI v29 bajado de mainnet) y `shhh-wallet-cairo` V8.4.
>
> **v2:** cada afirmación P0/P1 se intentó refutar con una segunda revisión independiente. Los cambios están en la §6.
>
> **Escrituras en repos de Chipi:** una sola, a pedido del usuario: la rama `chipi-back:docs/remove-new-sdk-flow` (`192480e`), que quita la rama inexistente `new-sdk` del README. `main` no se tocó.
>
> Regla: **todo dentro de 14.x**, sin romper la API pública.

---

## 0. Resumen ejecutivo

**Hallazgos por tipo**

| Tipo | Cuántos | Dónde se arregla |
|---|---|---|
| chipi-back | 22 | Deploy |
| x402-facilitator hosteado | 4 | Deploy |
| SDK (bugs) | 26 | npm / PyPI |
| No construido o a medias | 9 | npm / backend |
| walletv2 (app) | 7 | Deploy de la app |
| Solo docs/skills | 8 | Sin release |
| Infra/ops | 5 | Ops |

**12 P0 de seguridad. Los 10 más graves se mitigan sin release de npm:**

| ID | Qué | Verificado |
|---|---|---|
| **B13** | `GET /v1/wallets/by-user` devuelve la wallet de **cualquier** usuario de la org (incluye `encryptedPrivateKey`), porque no compara `externalUserId` con el JWT. Permite fuerza bruta offline del PIN | Por mí |
| **B14** | `env.txt` está **versionado** con valores cargados: `SKU_REFUND_SIGNER_PK`, `API_KEY_ENCRYPTION_KEY`, `MERCHANT_WALLET_ENCRYPTION_KEY`, `DATABASE_URL`, `PAYMASTER_API_KEY`, `NEON_API_KEY`… | Por mí (sin leer los valores) |
| **B15** | `test/smoke/ai-full-integration.smoke.ts:19` tiene una `sk_prod_…` real hardcodeada | Por mí |
| **B1** | Con una `pk_` (incluida la `pk_dev_` automática) se crean gifts que se cobran como USDC real de mainnet | Por mí |
| **P1** | `/privacy/fund-gas` manda hasta 15 STRK a **cualquier** `companion`; las llaves de la allowlist no tienen tope | Por mí |
| **F1** | El facilitator hosteado acepta cualquier tx exitosa como pago de sesión y se puede reutilizar | Por mí |
| **B2** | `/v1/ai/*` acepta la `pk_` pública | Por mí |
| **B3** | El cobro de IA falla en silencio: llamadas gratis ilimitadas | Doble revisión |
| **B4** | Firebase sin regla `aud`: suplantar a cualquier usuario (junto con B13, cualquiera en internet) | Doble revisión |
| **X1** | El `X402Facilitator` del SDK no valida el calldata SHHH | Doble revisión |
| **X2 / X11** | Verificación "de presencia" y nonces que nunca se consumen en `verifyOnly`: un mismo header de pago se reutiliza sin límite | Doble revisión |

**Lo que no funciona aunque los docs digan que sí:**
- Sesiones vía `useChipiSession`: el decode está mal (S1) y el hook solo acepta CHIPI (S2).
- Permisos de sesión escritos como nombres (S3).
- x402 estándar: **nunca** se ha liquidado un pago estándar en mainnet. El dashboard del facilitator hosteado registra una sola transacción, y es de sesión (X3).
- Shield de privacidad vía SDK en mainnet (P3).

**Releases propuestos**

| Ola | Versión | Contenido | Cuándo |
|---|---|---|---|
| **0** | n/a (deploys) | Los P0 de backend, facilitator y walletv2; rotación de secretos | **Hoy** |
| **1** | **14.13.1** (patch, solo fixes) | Bugs sin tocar la API pública | Esta semana |
| **2** | **14.14.0** (minor) | Lo aditivo pequeño: exports, campos nuevos, sesiones SHHH, `sdk.ai`, X2 activo por default junto con `SessionTxVerifier` | ~2 semanas |
| **3** | **14.15.0** (minor) | x402 que liquida de verdad (`payload.oe`), SHHH en `useX402Payment`, `withX402` para Next, verificador compartido, x402 v2 | Después |
| **4** | **14.16.0** (minor) | Guardianes en el SDK (desde walletv2), `useSessionSetup` | Después |
| ∥ | n/a | Docs y skills | Desde ya |

---

## 1. Hallazgos

Tipos: BACK = chipi-back · FAC = facilitator hosteado · SDK · NB = no construido · PART = a medias · APP = walletv2 · DOCS · OPS.

### 1.1 chipi-back

| ID | Hallazgo | Sev | Evidencia | Ola |
|---|---|---|---|---|
| **B13** | IDOR en `GET /wallets/by-user` y `credential-recovery`: toman `externalUserId` del query sin atarlo al `sub` del JWT (guardian-invites sí lo ata) | P0 | `wallets.controller.ts:117-150`, `wallets.service.ts:814-833` | 0 |
| **B14** | `env.txt` versionado con ~29 secretos cargados. **Tratar como comprometidos y rotar todos**; revisar si alguno es de prod; sacarlo del repo (el historial sigue teniéndolos) | P0 | `git ls-files env.txt` | 0 |
| **B15** | `sk_prod_…` y `pk_prod_…` hardcodeadas como default en un smoke test. Rotar y leer solo de env | P0 | `test/smoke/ai-full-integration.smoke.ts:18-20` | 0 |
| **B1** | Gifts: `pk_` crea y cobra; DEV y exentas sin hold; sin topes por default; el redeem manda USDC de mainnet | P0 | `gifts.controller.ts:153-236`, `gifts.service.ts:70-100,632` | 0 |
| **P1** | `/privacy/fund-gas`: `companion` sin validar; allowlist explícita sin tope (la `pk_` de walletv2 es pública); con `"*"`, `pk_dev_` + un JWKS propio da 25×15 STRK/día por llave; el meter falla abierto | P0 | `privacy.controller.ts:46-58`, `privacy-gas.service.ts:111-120`, `privacy-meter.service.ts:44-49,213-266` | 0 |
| **B2** | `/v1/ai/*` acepta `pk_`; `RateLimitGuard` nunca se aplica; los docs recomiendan `pk_`. Solo `pk_prod_` es explotable (DEV = sandbox) | P0 | `api-key.guard.ts:40`, `api-keys.module.ts:12`, `quickstart.mdx:129` | 0 / 2 |
| **B3** | El cobro va después del proveedor y el error se traga (`checkBalance` sin lock pide $0.001). El stream no cobra si falla a mitad. Las exentas nunca pagan | P0 | `ai.controller.ts:765,809-836,871-879`, `treasury.service.ts:179-193,260-269,318-325` | 0 |
| **B4** | Firebase usa certificados compartidos por Google e ignora `jwksUrl`; `iss`/`aud` opcionales; el DTO acepta `[]` | P0 (orgs Firebase) | `bearer-token.guard.ts:429-465`, `create-jwks.dto.ts:69-78` | 0 (auditar) → 2 |
| B5 | Limitador por modelo global: `gemini-pro` = 1 RPM para todos | P1 | `model-rate-limiter.service.ts:83`, `model-router.service.ts:122` | 0 |
| B6 | JWKS sin `kid`: **falla siempre que el JWKS tenga más de una llave** (jwks-rsa 3.2.0). Cliente por request. Sin `isActive`/`expiresAt`. El error repite el `pk_` | P1 | `bearer-token.guard.ts:169-194,228,236` | 2 |
| B7 | Recuperación de treasury con `pk_` y sin firma: cancela las pendientes y guarda un `oeHash` sin recalcular (riesgo de phishing a guardianes) | P1 | `sdk-treasury.controller.ts:242-261`, `treasury-recovery.service.ts:144-162` | 0 (sk_) / 2 (recalcular) |
| B8 | `sk_` en texto plano, sin rotación; `validateApiKey` sin `expiresAt`. El dashboard relee el `sk_` completo | P1 | `schema.prisma:20`, `api-keys.service.ts:138-151`, `api-keys.controller.ts:30-46` | 2 |
| S5b | `executeSponsoredTransaction` guarda **SUCCESS con el calldata enviado, antes del recibo**. Hasta las revertidas quedan SUCCESS. `phantom-check` solo en shadow | P1 | `transactions.service.ts:338-368,386,456-462` | 2 |
| G5b | Friend recovery marca INITIATED con cuenta regresiva en cuanto el paymaster **acepta** la tx, sin mirar el recibo | P1 | `friend-recovery.service.ts:253-285` | 0 |
| G3 | Una recuperación de wallet personal no notifica a nadie (e3b63ca es solo para treasury) | P1 | `friend-recovery.service.ts:200-290` | 0 |
| P2 | `fund-gas` reintenta ante un "timeout" y puede mandar el doble (nonce compartido con CCTP/gifts) | P2 | `privacy-gas.service.ts:140-163` | 0 |
| P3b | El prover **descarta** `additional_data` (la atestación que exige el pool v2.0) | P1 | `privacy-prover.service.ts:140-144` | 0 |
| B9 | Webhooks sin timestamp; repetibles | P2 | `run-send-webhook-notification.ts:63-77` | 2 |
| B10 | `verify-sku-recharge-transaction` sin auth (~12 s y 4 RPC por llamada) | P2 | `blockchains.controller.ts:11-18` | 0 |
| B12 | `/think` sin validación; si falla el parseo responde 201 con `{raw}` y cobra | P2 | `ai.controller.ts:430-436` | 2 |
| B11 | Llave de Infura hardcodeada | P3 | `src/blockchains/rpc-chain.ts:66` | 2 |
| B16 | `primaryRpcProvider` quedó como export muerto tras #410 (riesgo de que alguien lo reuse para escribir) | P3 | `src/blockchains/rpc-chain.ts:342` | 2 |

### 1.2 x402-facilitator (hosteado)

| ID | Hallazgo | Sev | Evidencia | Ola |
|---|---|---|---|---|
| **F1** | Pago de sesión = cualquier recibo no revertido. Sin `Transfer` from/to/monto. El nonce lo elige el cliente, así que el txHash se reutiliza. Acepta pendientes | P0 | `src/lib/facilitator.ts:86-96,137-142`, `signature.ts:121-143` | 0 |
| F2 | `/api/verify` y `/api/settle` sin auth, CORS `*`, sin `paymentRequirements`, sin rama SHHH. Cualquiera que vea un X-PAYMENT puede adelantarse al `settle` y quemar el nonce | P1 | `app/api/*`, `vercel.json`, `signature.ts:28-41` | 0 / 2 |
| F3 | El settle estándar llama a `paymaster.chipipay.com` (JSON-RPC) con cuerpos REST y sin `x-api-key`: falla aunque la firma fuera correcta | P1 | `src/lib/paymaster.ts:8,82-117` | 3 |
| R2 | La cadena RPC termina en Lava (muerta, responde 410); no trata 410 como error de transporte (el bug del outage del 2026-09-07) | P1 | `src/lib/rpc.ts:10,59,139` | 0 |

### 1.3 SDK

| ID | Hallazgo | Sev | Evidencia | Arreglo | Ola |
|---|---|---|---|---|---|
| **X1** | El validador del `oeCalldata` SHHH no existe | P0 | `backend/src/x402/facilitator.ts:170-181,265-275` | Parser interno (no exportado): 1 llamada, USDC, `transfer`, `[payTo, low, high]`, `execute_before ≤ validUntil`, caller ANY o paymaster | 1 |
| **X2** | Verificación de presencia por default; `verifyOnly` acepta firmas falsas. **Python igual** (sin opción de `provider`) | P0 | `facilitator.ts:183-189`, `chipi-sdk.ts:141-144`, `python/.../x402_facilitator.py:132-138` | **1:** warning ruidoso. **2:** `provider` por default + `allowPresenceOnlySignatures`, **junto con `SessionTxVerifier`** (si no, rompe a los merchants honestos con `verifyOnly` y sesión) | 1 → 2 |
| **X11** | **`verify()` nunca consume el nonce**, así que en `verifyOnly` un header se repite infinitamente; `validUntil` sin tope | **P0 en `verifyOnly`** | `facilitator.ts:18-30,116,248`, `middleware.ts:193-209` | Consumir el nonce en `verifyOnly`, tope `validUntil ≤ now + maxTimeoutSeconds`, TTL. Clave `from:nonce` **solo** en el store en memoria (en stores propios, consultar ambas claves) | 1 |
| **S1** | El decode de `getSessionData` está mal. Es **el mismo struct en v29, v33 y SHHH** (verificado on-chain) | P1 | `backend/src/sessions.ts:405-409`, `python/.../sessions.py:405-409` | `isActive = valid_until≠0 && now≤valid_until && calls_used<max_calls`; entrypoints vía `get_session_allowed_entrypoint_at` en CHIPI, `undefined` en SHHH; **cambio en `useChipiSession.ts:240`** para que expirada ≠ revocada | 1 (campos nuevos en 2) |
| **S3** | Nombres → short-string (CHIPI) o excepción (SHHH). **Python igual** | P1 | `sessions.ts:223`, `sessions.py:218`, chipi-back `paymaster.service.ts:55` | `normalizeEntrypoints` + `hash.getSelector` (TS, Python, backend) | 1 |
| S6 | `walletType` omitido: tratamiento inconsistente | P2 | `sessions.ts:64,530,671` | Resolver por class hash | 1 |
| S8 | SHHH ignora `saveToDatabase`. Warning solo si el `validUntil` firmado es **mayor** que el on-chain (v33); en SHHH no aplica | P3 | `execute-paymaster-transaction.ts:94-105` | Pasar el flag | 1 |
| S4 | v29 no tiene spending policies: el `get` devuelve ceros en silencio. `maxPerWindow=0` = ilimitado; `maxPerCall=0` bloquea todo | P2 | `sessions.ts:564,632,640,797-839` | **1:** warnings + docstrings. **2:** `{supported}` | 1 / 2 |
| **PF1** | passkey 2.3.0 (`requirePrf` por default) **rompe** la creación en autenticadores sin PRF para todo 14.9–14.13 (`^2.2.0`). `useCreateWallet` y `useMigrateWalletToPasskey` convierten el error en `Error` genérico y pierden el `code` | P1 | `useCreateWallet.ts:86-90`, `useMigrateWalletToPasskey.ts:55` | **1:** re-lanzar conservando `code: "PRF_UNSUPPORTED"` y `cause` + nota. **2:** pasar `requirePrf` + exportar `PrfUnsupportedError` | 1 / 2 |
| P3 | Shield vía SDK: sin atestación, prueba, paga gas y revierte; no hay fail-fast | P1 | `core/src/privacy/chipi-proof-provider.ts:132-135` | `requireAttestation` (default true en depósitos) | 2 (core) |
| P4 | `usePrivacy` usa Cartridge como fallback SNIP-36, y Cartridge descarta `proof_facts`: reenvía tras una prueba pagada donde no puede funcionar | P1 | `chipi-react/src/hooks/usePrivacy.ts:75,118-133`, `core/src/privacy/submit.ts:174,292` | Sin fallback a nodos sin `proof_facts` | 1 |
| P5 | Unshield puede reportar éxito sin entregar (`balanceOf` traga el error como 0) | P1 | `core/src/privacy/gas.ts:103,178-218` | Propagar el error | 1 (core) |
| P6 | `waitForTransaction` falla → "no confirmado" aunque se asentó; el reintento cobra dos veces | P2 | `shield-hl.ts:80-83,156-159` | Estado `unknown` con hash | 1 (core) |
| P11 | `requestGasFunding` manda el `pk_` como Bearer si no hay token | P3 | `core/src/privacy/gas.ts:78` | Error claro | 1 (core) |
| R1 | **Python usa Lava (muerta) como RPC por default** | P1 | `python/chipi_sdk/constants.py:29` | Cadena igual a TS | 1 (PyPI) |
| X3 | `{r,s}` estándar no puede liquidar (se firma `Payment`, se envía otro OE). **Python también** | P1 | `core/src/x402/client.ts:292-301`, `facilitator.ts:302-321`, `x402_facilitator.py:161-173` | `payload.oe` opt-in. **Antes:** verificar que `execute-sponsored-raw` acepte cuentas no SHHH | 3 |
| X4 | Sesión: con el facilitator del SDK el comprador paga y recibe 402; **con el hosteado funciona**, pero sin verificación (F1) y con una carrera (no espera la inclusión) | P1 | `useX402Payment.ts:261-275` | `SessionTxVerifier` con store durable (2); `X402SessionClient` (3) | 2 / 3 |
| X5 | `useX402Payment` no paga desde SHHH | P1 | `useX402Payment.ts:293-324` | Rama SHHH | 3 |
| X6 | Middleware liquida antes del handler. En Express, "after-success" no puede devolver 402 si el settle falla: hay que bufferizar o documentar el tradeoff | P2 | `middleware.ts:193-219` | En `processX402Request` | 3 |
| G1 | `<Recover>` sin fase expirada | P1 | `Recover.tsx:42-46,93-103` | `expiresAt` opcional | 2 |
| G5 | `ADD_GUARDIAN=86_400` sin uso (real: 48 h). Python igual | P3 | `shhh/recovery.ts:82`, `recovery.py:87` | `@deprecated` | 1 |
| PK1 | Subpath `sku-purchases` roto (el index sí lo exporta) | P2 | `backend/tsup.config.ts:8` | Renombrar la entry | 1 |
| PK2 | `chipi-react/components` sin entry ni archivo | P2 | `package.json:62` | Entry + archivo | 2 |
| PK3 | nextjs sin `useX402Payment`, `useGuardianRecovery`, `useShhhSigner`, `useThresholdSign`, `useMigrateWalletToShhh`, `useGetSkuPurchase`, `Recover`, clases de error, `PrfUnsupportedError` | P2 | `nextjs/src/hooks.ts` | Re-exports | 2 |
| NB9 | Expo sin guardian, x402, `shhhSigner`, `thresholdSign`, `migrateToShhh` (privacidad: probablemente no aplica en RN) | P2 | `chipi-expo/src/index.ts` | Re-exports | 2 |
| PK5 | backend fija `starknet 9.2.1` exacto; los peers `>=9.2.1` admiten starknet 10; condiciones de types | P3 | `backend/package.json:127` | `^9.2.1` y `<10` | 1 |

### 1.4 No construido o a medias

| ID | Qué | Ola |
|---|---|---|
| NB1 | Spending policy con passkey en React (`getEncryptKey`/`usePasskey`) + builders puros; luego `useSessionSetup` (un Face ID) | 2 / 4 |
| NB2 | `processX402Request` + `withX402` (Next) | 3 |
| NB3 | `sdk.ai` en backend (solo `sk_`) | 2 |
| NB4 | Pago x402 en `/v1/ai/*` | 3+ |
| NB5 | Guardianes en el SDK. *Nombres propuestos:* `readPendingOp`, `readPendingRecovery`, `readOwners`, `isOpExpired` y `useRecoveryService` existen en walletv2; `executeShhhSponsoredRawWithSigner`, `relayFinalizeRecovery` y `ChipiGuardians` son nuevos | 4 |
| NB6 | Guardián tipo C sin flujo de recovery (los docs lo anuncian). GaaS falla cerrado si falta `GAAS_SIGNER_URL` | 4 / ops |
| NB7 | Un solo verificador x402 (hoy hay 3 distintos: SDK, hosteado, Python) | 3 |
| NB8 | x402 estándar/v2 (base64, `accepts[]`, CAIP-2) | 3 |
| P8 | Una recuperación con guardián **no** recupera fondos shieldeados (la semilla cuelga del PRF de la passkey). Falta un gate de elegibilidad en el SDK | 3 |

### 1.5 walletv2 (app)

| ID | Hallazgo | Sev | Evidencia |
|---|---|---|---|
| **G2** | **Cancelar una recuperación desde un dispositivo agregado (la Mac) falla**: `RecoveryAlert` usa el `encryptKey` del owner primario | P1 | `recovery-alert.tsx:33-37`, `lib/chipi/recovery.ts:566-588,801-806` |
| **G4** | El amigo que aprueba pide el JWT **antes** de la biometría (el mismo bug #233 del owner) y necesita su dispositivo primario | P1 | `lib/chipi/friend-recovery.ts:162,204-215` |
| P9 | Cuota de shield sin límite por usuario (uno quema los 45/día). `/api/privacy/prove` salta `reserveShield` y gasta la cuota del relay | P1 | `server/routers/privacy.ts:182-205`, `app/api/privacy/prove/route.ts:47-56` |
| P4-app | Cartridge como RPC del browser para privacidad | P1 | `hooks/usePrivacy.tsx:95,528` |
| P10 | El ledger privado lo escribe el cliente, sin verificación on-chain; el tope del relay está en conflicto (10 vs 50) | P2 | `privacy.ts:225-300`, `privacy-flags.ts:18-33` |
| B1-app | `pk_prod` en el bundle (`useFxRates.tsx:10`). Esperado para `/ai/prices`, pero amplifica B1, B2 y P1 | n/a | n/a |
| R4 | `directRpcUrl()` en el server devolvería Starkscan (solo lectura). Latente | P3 | `lib/chipi/rpc.ts:106,297` |

### 1.6 Docs y skills

| ID | Qué | Sev |
|---|---|---|
| D1 | Sesiones: "solo CHIPI" en ~15 páginas; CHANGELOG 14.13 "SHHH no tiene session keys"; `multisig-governance:649` "próximamente"; nombres en vez de selectores; guía contradictoria sobre sesiones en el server (y `gasless/sessions` cifra con el PIN) | P1 |
| D2 | `recovery.mdx`: `useChainState` ficticio; finalize por el camino equivocado; tipo C anunciado; falta la nota del JWT | P1 |
| D3 | Skills: hooks y paquetes que no existen, CHIPI como default, **~14 archivos usan la `pk_` como bearer** | P1 |
| D4 | AI API: enum de `/think` distinto; `/execute` solo swap; recomienda `pk_` en el browser | P1 |
| D5 | x402: "hace fallback" si la sesión expiró (falso); sesión en Node con `X402Client` (no funciona); CHANGELOG "session txHash support" | P2 |
| D6 | Imports inexistentes desde nextjs; Expo `useBiometrics`; `wallet.wallet`; release notes solo hasta 14.7; README de GaaS desactualizado | P2 |
| **D7** | **Gift cards: los docs dicen "`sk_` o `pk_`"** (`gift-cards/endpoints.mdx:14,88,245,258`, `overview.mdx:37`). El fix de B1 necesita un aviso de deprecación | P1 |
| **P7** | Privacidad: los docs dicen que "el prover privado de Chipi ve la pool key", pero en prod la llave va al relay de **Starkscan** (un tercero). Hay que divulgarlo | P1 |

### 1.7 Infra y ops

| ID | Qué | Sev |
|---|---|---|
| O1 | Certificado de `mcp.chipipay.com` vencido desde el 18 de abril | P1 |
| O2 | El CI no corre publint, attw, chequeo de exports ni `docs:check` (que cubre 6 archivos). Los smokes SHHH son de **staging** y manuales | P2 |
| O3 | `HOW_TO_RELEASE.md` desactualizado; `staging` muerto desde marzo (sdks: 8 de mayo); `feat/release-smokes` sin mergear; build-with-chipi con CHANGELOG atorado; ramas x402 ya mergeadas; `wednesday-release` obsoleta | P3 |
| R3 | Los workflows de smoke caen a Lava si el secret está vacío | P2 |
| O4 | El prover de chipi-back usa por default `strk20-prover.railway.internal` (depende de la red privada de Railway) | P2 |

### 1.8 No son bugs o ya están resueltos

- **Regresión del RPC de escritura (ítem 1 de tu handoff): resuelta en código.**
  - #410 (`5949fcc`, 17 de septiembre) ya está en `main`.
  - Los 5 `Account.execute()` usan `writeRpcProvider()`: CCTP burn, card funds, privacy gas, CCTP mints y deposits.
  - El canary del prover ya se retiró.
  - El rechazo que menciona el handoff es del 10 de septiembre, anterior al fix.
  - **Pendiente:** confirmar en Railway que prod corre un commit igual o posterior a `5949fcc`; el repo no tiene endpoint de versión.
- En el SDK de TS ninguna escritura pasa por Starkscan (solo las lecturas usan `withRpcFallback`).
- `enableDebugMessages`: solo son warnings de consola, no filtran nada.
- `fix/x402-session-txhash` y `feat/x402-sugar-layer`: ya están en main.
- Usar `pk_` como bearer da 401 (no es un hueco).
- CORS `*`: no hay auth por cookies.

---

## 2. Plan por olas

### Ola 0: hoy, solo deploys y ops

**Secretos (primero, porque B14 y B15 pueden hacer irrelevante todo lo demás)**
1. Rotar **todo** lo que está en `env.txt`, en este orden:
   1. `SKU_REFUND_SIGNER_PK` (mover los fondos de esa dirección si tiene saldo);
   2. `API_KEY_ENCRYPTION_KEY` y `MERCHANT_WALLET_ENCRYPTION_KEY` (ojo: re-cifrar lo que protegen antes de cambiarlas);
   3. `DATABASE_URL`/`DIRECT_URL` + `NEON_API_KEY`;
   4. `PAYMASTER_API_KEY`, `TRIGGER_SECRET_KEY`, `RESEND`, `COINGECKO`, `IDENFY`, `TET`.
   - Sacar `env.txt` del repo y agregarlo a `.gitignore`. El historial conserva los valores, así que rotar es obligatorio.
2. Rotar la `sk_prod`/`pk_prod` del smoke test (B15) y leerlas solo de env.
3. Aprovechar para mover `DATABASE_URL`/`DIRECT_URL` a variables de referencia de Railway (ítem 2 de tu handoff).

**chipi-back**

4. **B13:** `by-user` y `credential-recovery` exigen `externalUserId == sub` del JWT (con `sk_` se mantiene el acceso de servidor).
5. **B1:**
   - `sk_` obligatoria en las rutas de gifts autenticadas, **excepto `claim/:code*`**, con periodo de deprecación y aviso (D7);
   - DEV: sin envío on-chain, respuesta `sandbox: true` (walletv2 staging depende de los redeems DEV: avisar);
   - topes no nulos para orgs exentas y sin `OrgBalance`;
   - **auditar los `GiftRedeem` desde el 2026-07-22.**
6. **P1:** `companion` debe ser el companion derivado y registrado del usuario del JWT; tope por usuario y por llave también para la allowlist explícita; meter que falle cerrado. **P2:** no reintentar si hay riesgo de que la tx ya se haya enviado.
7. **B3:** usar el `treasury.hold` existente, atómico, antes del proveedor; liquidar después o liberar; nunca tragar el error; cobrar el stream parcial.
8. **B2 fase 0 y B5:** límite y tope por org **solo en chat, think, stream y execute** (no en prices/models/signals, que walletv2 usa desde el browser); `sk_` en `/ai/usage`; headers de deprecación para `pk_`.
9. **B7:** `sk_` para crear (el recálculo del `oeHash` va en la ola 2). **B10:** guard.
10. **B4:** auditar las configs Firebase/Generic sin `aud` y avisar a esas orgs.
11. **G5b:** marcar INITIATED solo con el recibo. **G3:** notificar al owner y a los guardianes en las recuperaciones personales.
12. **P3b:** reenviar `additional_data` en el prover.

**x402-facilitator**

13. **F1:** evento `Transfer` (USDC, from, to, `value ≥ amount`); `tx_hash` único **insertado junto con el nonce** (deduplicar antes de la migración); la misma regla en `/api/verify`; recibo SUCCEEDED pre-confirmado + reintentos.
14. **F2:** `paymentRequirements` opcional, rate limit. **R2:** Cartridge al final de la cadena + 410 como error de transporte.

**walletv2**

15. **G2**, **G4**, **P9**, **P4-app** (ver §3).

**Ops**

16. **O1:** certificado de MCP.
17. **R3:** secrets de los smokes.
18. Confirmar el SHA desplegado en Railway (§1.8).

**Criterio de salida:** tests de regresión para B13, B1, P1, B3 y F1, más la rotación completa verificada.

### Ola 1: **14.13.1** (patch: solo fixes, sin API nueva) + `chipi-stack` en PyPI + `core` 0.6.1

| Cambio | Dónde |
|---|---|
| X1 parser del OE (interno) | `backend/src/x402/facilitator.ts`, `shhh/parse-oe-calldata.ts` |
| X11 consumir el nonce en `verifyOnly`, tope de `validUntil`, TTL, clave `from:nonce` solo en memoria | `facilitator.ts` |
| X2 **warning** si falta `provider` (TS + Python) | `facilitator.ts`, `x402_facilitator.py` |
| S1 decode (TS + Python), sin campos nuevos; `useChipiSession` expirada ≠ revocada | `sessions.ts`, `sessions.py`, `useChipiSession.ts:240` |
| S3 selectores (TS + Python) | `sessions.ts`, `sessions.py`, `execute-paymaster-raw.ts:112`, `snip12-hash.ts:90` (+ deploy de chipi-back `paymaster.service.ts:55`) |
| S6, S8, S4 (warnings + docstrings), G5, PK1, PK5 | backend, python |
| PF1 conservar `code: "PRF_UNSUPPORTED"` y `cause` | `useCreateWallet.ts`, `useMigrateWalletToPasskey.ts` |
| P4, P5, P6, P11 (privacidad) | `core/src/privacy/*` (0.6.1), `usePrivacy.ts` |
| R1 RPC de Python | `python/chipi_sdk/constants.py` |
| CHANGELOG ("SHHH no tiene session keys") | `*/CHANGELOG.md` |
| **O2:** publint + attw + chequeo de exports contra el tarball + `docs:check` en CI | `.github/workflows/ci.yml` |

**Criterio de salida:**
- **smoke SHHH en mainnet** (hoy solo existe en staging: crear una versión mainnet con el mínimo de fondos): sesión registrada con nombres → `isActive: true` → ejecuta;
- tests de manipulación del OE;
- tests de replay en `verifyOnly`;
- los exports resuelven en el tarball.

### Ola 2: **14.14.0** (minor)

- **Sesiones:**
  - S1: campos `maxCalls`/`callsUsed`/`allowedEntrypoints` por tipo;
  - S2: SHHH en los hooks + `supportsSpendingPolicies`;
  - S4: `{supported}`;
  - NB1a: `getEncryptKey`/`usePasskey` + builders puros.
- **x402:**
  - X2 `provider` por default + `allowPresenceOnlySignatures` **en el mismo release que** `SessionTxVerifier` (store durable).
  - **Riesgo:** una caída del RPC ahora rechaza pagos, y el default usa una llave de Infura hardcodeada (`shared/src/constants/rpc.ts:43`). Documentar que se configure `provider` propio.
- **Exports:** PK2, PK3, NB9; PF1 (`requirePrf` + `PrfUnsupportedError`).
- **IA:** NB3 `sdk.ai` + tipos `ThinkDecision` reales.
- G1 `<Recover>` expirada. P3 `requireAttestation` (core 0.7.0).
- **Backend en paralelo:**
  - B2 fase 1: `allowPublicAi` + `allowedOrigins`; registrar si cada llamada vino con `pk_` o `sk_`;
  - B6 (conservar el fallback de una sola llave sin `kid`);
  - B8 (primero show-once y rotación en el dashboard, luego hash);
  - B9 (header **nuevo**, sin cambiar `chipi-signature`);
  - B12, B7 (recalcular el `oeHash`);
  - S5b (estado nuevo o flag antes de voltear a FAILED);
  - F2 rama SHHH con el parser de X1;
  - B11, B16.

### Ola 3: **14.15.0** (minor), x402 que funciona de verdad

- Primero verificar que el paymaster acepte OE de cuentas CHIPI/READY en `execute-sponsored-raw`.
- Después:
  - X3 `payload.oe` (TS + Python);
  - X4 `X402SessionClient`;
  - X5 SHHH en el hook;
  - F3 facilitator hosteado sobre REST real con `x-api-key`;
  - NB2 `processX402Request` + `withX402` + X6 con el tradeoff documentado;
  - NB7 verificador compartido (hosteado y Python lo adoptan);
  - NB8 v2;
  - P8 gate de elegibilidad de privacidad.

### Ola 4: **14.16.0** (minor)

- NB5 guardianes en el SDK (walletv2 migra y borra ~2,7k LOC).
- NB1b `useSessionSetup`.
- NB6 tipo C u ocultarlo.

### En paralelo: docs y skills

D7 y P7 (urgentes, acompañan a la ola 0), D1, D4, D2, D3, D5, D6, O3.

---

## 3. Gates operativos de tu handoff

### 3.1 Simulacro de recuperación en prod (wallet `0x65ea61b4…`, guardianes aida y tabatha, Mac como owner agregado)

**Antes del simulacro:**
- [ ] Confirmar `NEXT_PUBLIC_GUARDIANS_ENABLED=true` en prod; sin eso no aparece `RecoveryAlert` y **nadie se entera** de una recuperación (G3).
- [ ] Desplegar G4: JWT fresco después de la biometría del amigo. Si no, el primer approve de aida o tabatha puede dar 401. Deben aprobar desde su **dispositivo primario**.
- [ ] Desplegar G5b, o como mínimo **consultar `get_pending_recovery` on-chain justo después del approve** en lugar de confiar en la cuenta regresiva de la UI.

**Durante:**
- [ ] Probar la cancelación **desde el dispositivo primario**; desde la Mac falla hasta que se arregle G2.
- [ ] Probar el ciclo completo: initiate → 7 d → finalize vía `/transactions/finalize-recovery`.
- [ ] El dispositivo recuperado debe entrar con el mismo usuario de Clerk (el finalize está limitado a la API key).
- [ ] Registrar los hashes de cada paso.

### 3.2 Encender `NEXT_PUBLIC_PRIVACY_ENABLED` en prod

No encontré el `privacy-enable-checklist` en ningún repo (vive en tu memoria local). Mínimos adicionales que salen del análisis:
- [ ] Simulacro 3.1 pasado.
- [ ] **P1 cerrado** (vaciado del gas tank).
- [ ] P9 (cuota por usuario y `/prove` detrás de `reserveShield`).
- [ ] P4-app (sin fallback a Cartridge).
- [ ] P3b (`additional_data`).
- [ ] **P7:** divulgar que la llave va al relay de Starkscan.
- [ ] Mostrar en la UI que los fondos shieldeados **no** se recuperan con guardianes (P8).
- [ ] O4: si el prover interno sigue en uso, depende de la red privada de Railway.

---

## 4. Dependencias

```
B14/B15 rotación ──► todo lo demás (si los secretos de prod están expuestos, los fixes no bastan)
S1 ──► S2 ──► NB1 ──► useSessionSetup
S3 ──► X4
X1 ──► F2(SHHH) ──► NB7
X2(default) ◄──► SessionTxVerifier   (mismo release)
X3 requiere: paymaster acepta OE no-SHHH ──► payload.oe ──► NB8
B2 fase 0 ──► NB3 sdk.ai ──► B2 fase 2 (apagar pk_ tras 60 días)
G2/G4/G5b/G3 ──► simulacro ──► flag de privacidad (junto con P1, P9, P4-app, P3b, P7)
O2 (CI de exports) antes de 14.13.1
```

## 5. Archivos por ola (para no chocar entre sesiones)

- **Ola 0:**
  - chipi-back: `env.txt`, `test/smoke/ai-full-integration.smoke.ts`, `src/wallets/wallets.controller.ts` + `.service.ts`, `src/gifts/*`, `src/privacy/{privacy.controller,privacy-gas.service,privacy-meter.service,privacy-prover.service}.ts`, `src/ai/ai.controller.ts`, `src/treasury/treasury.service.ts`, `src/organizations/{sdk-treasury.controller,treasury-recovery.service}.ts`, `src/guardians/friend-recovery.service.ts`, `src/blockchains/blockchains.controller.ts`;
  - x402-facilitator: `src/lib/{facilitator,signature,nonce-store,rpc,record}.ts`;
  - walletv2: `recovery-alert.tsx`, `lib/chipi/friend-recovery.ts`, `server/routers/privacy.ts`, `app/api/privacy/prove/route.ts`, `hooks/usePrivacy.tsx`.
- **Ola 1:**
  - sdks: `backend/src/{sessions.ts, x402/facilitator.ts, shhh/*, execute-paymaster-transaction.ts}`, `chipi-react/src/hooks/{useChipiSession,useCreateWallet,useMigrateWalletToPasskey,usePrivacy}.ts`, `core/src/privacy/*`, `python/chipi_sdk/{sessions,x402_facilitator,constants}.py`, `*/tsup.config.ts`, `backend/package.json`, `.github/workflows/ci.yml`;
  - chipi-back: `paymaster.service.ts`.
- **Ola 2:**
  - sdks: `chipi-react/src/hooks/{useChipiSession,useChipiWallet}.ts`, `routes/Recover.tsx`, `nextjs/src/hooks.ts`, `chipi-expo/src/index.ts`, `backend/src/ai.ts` (nuevo), `types/*`;
  - chipi-back: `src/auth/*`, `src/api-keys/*`, `prisma/schema.prisma`, webhooks.

---

## 6. Cambios de v1 a v2 (auditoría)

**Nuevos P0:** B13 (IDOR), B14 (`env.txt`), B15 (`sk_prod` en test), P1 (gas tank de privacidad).

**Nuevos P1:**
- backend y facilitator: F3, R2, S5b agravado, G5b, G3, P3b;
- SDK: PF1 (passkey 2.3.0), R1 (Python con Lava), P3, P4, P5;
- walletv2: G2, G4, P9;
- docs: D7, P7.

**Severidades corregidas:**
- X11 sube de P3 a P0 (en `verifyOnly`);
- B12 baja de P1 a P2;
- PK1 baja de P1 a P2;
- S4 baja de P1 a P2;
- B11 pierde el punto de `enableDebugMessages` (no es un hallazgo).

**Afirmaciones corregidas:**
- **X2:** activar el `provider` por default en el patch rompía a los merchants honestos con `verifyOnly` y sesión. Ahora es warning en 14.13.1 y el default se activa en 14.14.0 junto con `SessionTxVerifier`.
- **X4:** con el facilitator hosteado **sí funciona** (con carrera y sin verificación).
- **X3:** también rompe Python y el hosteado apunta mal al paymaster (F3); la línea correcta es `paymaster.ts:82-117`.
- **S1:** v29 tiene el mismo struct; el fix debe incluir el hook y el branch de entrypoints.
- **S3:** también Python; la línea de chipi-back es `:55`.
- **S8:** `validUntil` menor sí funciona.
- **D3:** ~14 archivos, no 19.
- **D5:** se quita la afirmación sobre `x402-shhh-buyers`.
- **O3:** `staging` de chipi-back está muerto desde marzo.
- **Semver:** 14.13.1 queda solo con fixes; todo lo que agrega API pasa a 14.14.0 (el precedente del repo es que lo aditivo va en minor).

**Riesgos de los fixes, ahora documentados:**
- B1: excluir `claim`; deprecación; staging DEV.
- B2: no limitar `prices`.
- B7: mantener la cancelación tras autenticar.
- B8: show-once antes del hash.
- B9: header nuevo.
- F1: unicidad atómica y en `verify`.
- X6: tradeoff de Express.
- X11: stores propios.

**Handoff:** el ítem 1 (write-path RPC) ya está en `main`; solo falta confirmar el deploy.
