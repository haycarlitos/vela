# Vela: ruta a producción (prioridad de todo el trabajo de Chipi)

> 2026-09-27. Este documento ordena `CHIPI-14X-PLAN.md` y `SPRINT-WALLETV2-VELA.md` desde Vela.
>
> **Conclusión:**
> - **Ningún fix de Chipi bloquea a Vela.** Con el SDK 14.13.0 publicado, Vela sale a producción con ~4 workarounds pequeños (~40 LOC), marcados `// TODO(chipi#X)`.
> - Los fixes de Chipi **quitan código** y dejan limpios los tutoriales. Se integran a medida que salen 14.13.1 y 14.14.0.
> - **La passkey es el camino principal**, y ya funciona en 14.13.0 con wallets SHHH.

---

## 1. Passkeys en Vela (lo más importante)

### 1.1 Cómo funciona (verificado en el código del SDK)

- La wallet SHHH creada con passkey tiene un **signer STARK**. Su llave privada va cifrada con una clave derivada del **PRF de la passkey**. Ni Chipi ni Vela pueden descifrarla (`sdks/backend/src/wallets.ts:125`).
- Toda firma del owner (registrar la sesión, fijar los límites, revocar) ocurre **en el navegador**: `getWalletEncryptKey()` pide Face ID o huella → desbloquea la llave en memoria → firma.
- El agente **nunca** tiene la llave del owner. Solo tiene la llave de sesión, limitada on-chain (selectores, `maxCalls`, `validUntil` y tope de gasto por token).

### 1.2 Flujo en Vela: dos momentos de biometría en total

```
Onboarding (1 Face ID)
  setupPasskey(userId, name, { requirePrf: true })       // chipi-passkey 2.3.0
  → encryptKey (PRF) → useChipiWallet().createWallet({ encryptKey, walletType: "SHHH" })
  → wallet desplegada gasless

"Contratar agente" (1 Face ID)
  server: sessions.createSessionKey({ encryptKey: VELA_SESSION_SECRET })   // se guarda en la DB de Vela
  browser: encryptKey = await getWalletEncryptKey(credentialId)           // biometría
           jwt = await getToken({ skipCache: true })                      // JWT fresco DESPUÉS de la biometría (walletv2 #233)
           useAddSessionKeyToContract(... selectores hex ...)
           chipiSDK.sessions.setSpendingPolicy(USDC) / (ETH) / (STRK)     // mismo encryptKey en memoria, sin otro prompt
"Detener" (1 Face ID)
  useRevokeSessionKey
```

Se copia de walletv2 (probado en prod):
- `hooks/useWalletCreation.tsx:29-62` (creación);
- `onboarding-flow.tsx:270-275` (manejo de `PRF_UNSUPPORTED`);
- `lib/chipi/recovery.ts:571-606` (encryptKey primero y JWT después).

### 1.3 Decisiones de passkey para el lanzamiento

| Tema | Recomendación | Por qué |
|---|---|---|
| Dispositivos sin PRF | **Exigir PRF** (como walletv2). Pantalla "tu dispositivo no es compatible; usa iPhone/Android actual o un gestor de contraseñas con passkeys" | Sin PRF, passkey 2.2 caía a PBKDF2, que es **custodial** (le pasa hoy a roca). Vela promete "self-custodial" |
| PIN de respaldo | No en v1 | Un PIN de 4–6 dígitos es fuerza-bruteable si el `encryptedPrivateKey` sale por `by-user` |
| Pérdida de la passkey | Depender de passkeys sincronizadas (iCloud / Google) + tope de depósito de $100. Guardián en v2 (se porta de walletv2) | El guardián requiere el ciclo completo probado (simulacro en curso en walletv2) |
| Otro dispositivo | `getWalletEncryptKey` necesita el `credentialId`; si no está en localStorage, se recupera con `credential-recovery` (`sdks`: `getStoredCredential`) | Solo se necesita al contratar o detener |
| Auditoría SHHH V8.4 pendiente | Beta con tope de depósito y aviso visible | Transparencia |

---

## 2. Qué le falta a Vela para producción (checklist)

Estado actual: nada funciona de punta a punta (ver `PLAN-PRODUCCION.md` §1–2).

| # | Pieza | Hoy | Qué hacer | Depende de Chipi | Días |
|---|---|---|---|---|---|
| 1 | **Higiene** | API key de Infura hardcodeada; `pk_prod` en `.env.example`; `/api/agent/execute` sin auth; `/api/init` pública | Rotar la llave y sacarla a env; placeholders; borrar los endpoints inseguros; LICENSE y README | No | 0.5 |
| 2 | **Auth** | `pk_` como bearer (401) | Clerk + `proxy.ts`; registrar el JWKS de Clerk en el dashboard de Chipi **con regla `aud`** (B4) | Config | 0.5 |
| 3 | **Passkey + wallet SHHH** | PIN + wallet CHIPI v29 | §1.2, portado de walletv2; subir a `@chipi-stack/*` 14.13 y passkey 2.3.0 | No | 1 |
| 4 | **Sesión del agente** | `lib/session.ts` con todos los campos mal; nombres en vez de selectores | Server: `createSessionKey` + DB. Browser: registro con **selectores hex** (`approve`, `transfer`, `deposit`, `redeem`, `multi_route_swap`). Server: `executeTransactionWithSession` | Workaround para S3 (pasar hex) | 1 |
| 5 | **Límites on-chain** | Solo en el prompt | `chipiSDK.sessions.setSpendingPolicy` en el browser, para USDC, ETH y STRK. **Nunca `maxPerWindow=0`** (sería ilimitado) | Workaround para NB1a (no hay hook) | 0.5 |
| 6 | **Guard de políticas** | No existe | `agent/policy.json` + `lib/policy.ts` (~50 LOC) | No | 0.5 |
| 7 | **Cerebro** | Anthropic directo; `chipi-client.ts` inventado | REST `/v1/ai/signals` + `/v1/ai/think` con `sk_` desde el server (~30 LOC). Validar la decisión del lado de Vela (`swap / supply / withdraw / hold`, B12) | Workaround para NB3 (no hay `sdk.ai`) | 1 |
| 8 | **Ejecución DeFi** | Builders propios | Swap vía `/v1/ai/execute`; Vesu con `vesu.ts` de walletv2; **confirmar con `waitForTransaction` y verificar el evento `Transfer`** (S5b: el backend marca SUCCESS antes del recibo) | Workaround para S5b | 0.5 |
| 9 | **Tick multi-tenant** | Single-tenant por env | Tablas `agents`, `decisions`, `memory`; cron (Vercel Pro o QStash) | No | 1 |
| 10 | **x402 `/api/think`** | Hecho a mano contra el facilitator hosteado (que no verifica) | El agente paga con `executeTransactionWithSession(transfer USDC)` y Vela **verifica on-chain el `Transfer`** + txHash único en su DB (~40 LOC). No depende del facilitator hosteado (F1) | Workaround para `SessionTxVerifier` | 1 |
| 11 | **Dashboard real** | 100 % demo | Estado del agente, feed (`useGetTransactionList`), sesión (llamadas restantes: leer on-chain o esperar S1) | Workaround para S1 | 1 |
| 12 | **Detener** | UI sin efecto | `useRevokeSessionKey` + `agents.active=false` | No | 0.25 |
| 13 | **Lanzamiento** | n/a | Tope de $100 por wallet; aviso de beta y auditoría; términos (agente no custodial, riesgo DeFi); alertas (Sentry + un cron que avise si fallan los ticks); org de Vela con créditos de IA | Config | 0.5 |
| 14 | **Prueba final** | n/a | 3 wallets internas × $20 × 72 h: cada decisión con tx, pago x402 y costo de IA verificables | No | 3 (en paralelo) |

**Total: ~9 días de trabajo + 3 días de prueba en paralelo.**

---

## 3. El plan de Chipi, re-priorizado por Vela

### Nivel A: config de Chipi que Vela necesita (sin código)
1. Org de Vela con `sk_`, JWKS de Clerk **con `aud`** y créditos de IA.
2. Confirmar que el plan de la org no limita `execute-sponsored-raw` (gate de plan en SHHH).

### Nivel B: fixes del SDK que eliminan los workarounds de Vela (y mejoran los videos)

| Orden | ID | Qué elimina en Vela | Release |
|---|---|---|---|
| 1 | **PF1** | Manejo limpio de `PRF_UNSUPPORTED` con los hooks del SDK (hoy Vela usa `setupPasskey` directo, como walletv2) | 14.13.1 |
| 2 | **S3** | Vela deja de calcular selectores a mano: los nombres funcionan | 14.13.1 |
| 3 | **S1** | "Sesión activa, N llamadas restantes" con `getSessionData` en lugar de leer on-chain a mano | 14.13.1 (campos nuevos en 14.14.0) |
| 4 | **S2 + NB1a** | `useChipiSession` con SHHH + passkey (`getEncryptKey`) + builders: el episodio "contrata a tu agente" cabe en un hook | 14.14.0 |
| 5 | **NB3** | `sdk.ai.signals/think/execute` en vez de fetch a mano | 14.14.0 |
| 6 | **`SessionTxVerifier`** | Vela deja de verificar el `Transfer` a mano en `/api/think` | 14.14.0 |
| 7 | **PK3** | `useX402Payment` y `PrfUnsupportedError` desde `@chipi-stack/nextjs` | 14.14.0 |
| 8 | NB2 `withX402` + X3/X5 | x402 estándar para el tutorial "tu API que cobra" | 14.15.0 |
| 9 | NB5 guardianes en el SDK | Episodio "si pierdes tu teléfono" en ~60 LOC | 14.16.0 |

### Nivel C: importante para Chipi, irrelevante para el lanzamiento de Vela
- P1, P3b, P9 (privacidad), el simulacro de guardianes y las mejoras de walletv2. Siguen en el sprint, pero **no bloquean a Vela**.
- B1, B2, B3 y B13 (shadow) y F1: protegen a Chipi; Vela no usa esos caminos o ya los evita.
- `env.txt`, `sk_prod` en test, certificado de MCP, higiene de releases: última prioridad.

---

## 4. Calendario propuesto

| Día | Vela | Chipi (en paralelo) |
|---|---|---|
| 1 | #1 higiene, #2 auth | Config de la org (nivel A) |
| 2–3 | #3 passkey + SHHH, #4 sesión, #5 límites | 14.13.1: PF1, S3, S1 (+ lo del sprint) |
| 4–5 | #6 guard, #7 cerebro, #8 ejecución | n/a |
| 6–7 | #9 tick, #10 x402, #12 detener | 14.14.0: S2, NB1a, NB3, `SessionTxVerifier`, PK3 |
| 8 | #11 dashboard, #13 lanzamiento; arranca #14 (72 h) | n/a |
| 9–11 | Reemplazar los workarounds por 14.14.0 (se borran ~40 LOC) | n/a |
| **12** | **Beta pública** | n/a |

---

## 5. Riesgos

| Riesgo | Mitigación |
|---|---|
| Usuarios sin PRF no pueden entrar | Pantalla clara + métrica de rechazos; decidir el PIN de respaldo con datos |
| Pérdida de la passkey | Passkeys sincronizadas + tope de $100 + guardián en la fase 2 |
| Un gasto por encima del tope se reporta como éxito (S5b) | Vela verifica el `Transfer` en cada ejecución |
| Selector de swap de AVNU cambia | Validar `multi_route_swap` contra el calldata real de `/v1/ai/execute` antes de registrar sesiones |
| Latencia de la IA o signals sin historial tras un reinicio de chipi-back (~7 min) | `[SILENT]` / hold si no hay signals |
