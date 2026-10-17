# Guía de prompts y recetas por plataforma · Bootcamp IBERO

Para todas las personas participantes. Cada receta sale de un paso real de Vela (el curso en `course/` y el código en `lib/`, `app/` y `components/`). Copia un prompt, cambia lo que va entre `<…>` y pégalo en tu asistente de código (Claude Code, Cursor u otro).

Si el curso o el código cambian, esta guía también cambia: ver [Cómo mantenerla](#cómo-mantenerla).

---

## Antes de empezar: reglas de seguridad

Vela maneja dinero real en **Starknet mainnet**. Estas reglas aplican a todos los prompts de esta guía:

- **Nunca pegues claves en un prompt**: ni `sk_...`, ni `CHIPI_SECRET_KEY`, ni `DATABASE_URL` completo, ni frases semilla o claves privadas de una cartera. Si necesitas que el asistente vea un valor, pon un marcador como `sk_prod_***`.
- **Empieza con centavos.** Usa `MAX_DEPOSIT_USD=100` (valor por defecto) o menos mientras pruebas.
- **Un tx hash no es un resultado.** Un tx enviado no significa que se ejecutó: espera el recibo (`waitForTransaction`) y revísalo en el explorador.
- **El modelo aconseja, `lib/policy.ts` decide.** Ningún prompt debe hacer que el agente actúe sobre `sdk.ai.think` sin pasar por `decide()`.

---

## Parte 1: prompts para tu asistente de código

Estos prompts sirven para entender y cambiar el repo. Úsalos en la raíz del proyecto.

### 1.1 Orientarse en el repo

```text
Lee CLAUDE.md y course/README.md. Resume en 10 líneas cómo funciona una vuelta del agente
(lib/agent.ts, runTick). Después dime qué archivo debo tocar si quiero cambiar <tu cambio>
y qué test lo cubre.
```

### 1.2 Verificar que todo está bien

```text
Ejecuta `npm run lint && npm run typecheck && npm test`. Si algo falla, explica cada fallo
con la línea exacta y la causa probable. No cambies los tests para que pasen.
```

### 1.3 Mantener el curso alineado con el código

```text
Cambié <archivo>. Busca en course/ qué módulos citan ese archivo y actualiza esos módulos
para que las líneas y los nombres coincidan con el código nuevo. No cambies nada más.
```

### 1.4 Revisión de seguridad de un cambio

```text
Revisa este diff como auditor de seguridad. Responde solo estas preguntas:
1. ¿La clave de sesión puede firmar algo fuera de SESSION_ENTRYPOINTS (lib/config.ts)?
2. ¿Algún token que la cartera puede tener queda sin spending policy (lib/policy.ts)?
3. ¿Hay una ruta que actúe sobre sdk.ai.think sin pasar por decide()?
4. ¿Alguna tx se da por buena sin waitForTransaction?
Para cada respuesta cita archivo:línea.
```

### 1.5 Si el SDK no hace lo que necesitas

```text
Necesito <capacidad> y no sé si @chipi-stack/backend la tiene. No la rodees con un parche.
Revisa node_modules/@chipi-stack/backend y dime si existe, o qué habría que agregar al SDK.
```

### 1.6 Mainnet: no uses testnet

```text
Busca en el repo cualquier referencia a testnet, Sepolia o una dirección distinta de
TOKENS.USDC en lib/config.ts. Si la encuentras, repórtala; no la cambies sin confirmarme antes.
```

---

## Parte 2: recetas por plataforma

Cada receta tiene: **qué es**, **pasos**, **prompt listo** y **cómo verificar**.

### 2.1 Chipi (dashboard y AI API)

**Qué es:** cartera, IA (`sdk.ai`) y paymaster de gas. Es la única cuenta que necesitas crear.

**Pasos**
1. Crea tu organización en [dashboard.chipipay.com](https://dashboard.chipipay.com) y una API key.
2. Copia la clave pública (`pk_...`) a `NEXT_PUBLIC_CHIPI_API_KEY` y la secreta (`sk_...`) a `CHIPI_SECRET_KEY`.
3. Para pruebas usa una clave de desarrollo (`pk_dev_...`): responde cada llamada de IA con una decisión de ejemplo. Para producción, recarga créditos de IA.
4. En la configuración de la API key, pon el JWKS en `https://<tu-app>/api/auth/jwks` con el proveedor **Better Auth**.

**Prompt listo**
```text
Mi app devuelve 401 cuando el usuario entra al dashboard. Revisa la ruta /api/auth/jwks y el
proveedor que tengo configurado. Dame una lista de comprobación de 5 puntos con lo que debo
ver en el dashboard de Chipi (sin pedirme las claves: usa sk_prod_***).
```

**Verificar:** `https://<tu-app>/api/auth/jwks` responde con un JSON de claves públicas.

### 2.2 Vercel (despliegue, variables y cron)

**Qué es:** hospeda la app y llama a `/api/tick` según `vercel.json`.

**Pasos**
1. Despliega con el botón del módulo 0 (`course/00-setup.md`) o conecta tu repo.
2. En **Settings → Environment Variables** pon las variables de `.env.example`. Las mínimas son `NEXT_PUBLIC_CHIPI_API_KEY`, `CHIPI_SECRET_KEY` y `DATABASE_URL`.
3. Pon `CRON_SECRET` en producción. Vercel Cron lo envía solo; un planificador externo necesita el mismo encabezado `Authorization: Bearer <CRON_SECRET>`.
4. Redespliega después de cambiar variables.

**Prompt listo**
```text
Mi despliegue en Vercel falla en el build. Este es el log (quita cualquier secreto antes de
pegarlo): <pega el log>. Identifica el primer error real, dime si es de código, de variables de
entorno o de dependencias, y propón el cambio mínimo.
```

**Verificar:** `GET /api/tick` sin `Authorization` responde 401 cuando `CRON_SECRET` está puesto.

### 2.3 Neon / Postgres (base de datos)

**Qué es:** guarda `agents`, `decisions` y `trusted_wallets`. Las tablas se crean la primera vez que se usan (`lib/db.ts`).

**Pasos**
1. Vercel crea la base en Neon y pone `DATABASE_URL`. Si usas otra, cópiala del proveedor.
2. Para Postgres local sin TLS, pon `DATABASE_SSL=false` (solo en tu máquina).
3. No pegues la URL completa en ningún prompt: tiene la contraseña.

**Prompt listo**
```text
Lee lib/db.ts y dime qué tablas y columnas crea. Escribe una consulta SQL para ver las últimas
10 decisiones de un agente con su motivo y su estado, usando el nombre real de las columnas.
No ejecutes nada contra la base.
```

**Verificar:** la consulta devuelve filas después de que el agente decida una vez.

### 2.4 Passkeys en el navegador (Better Auth)

**Qué es:** tu cuenta y tu cartera se abren con tu rostro o huella. La passkey queda ligada al nombre del dominio.

**Pasos**
1. Crea la cuenta y la cartera en la app desplegada, no en `localhost`.
2. Si cambias de dominio, las passkeys de antes no sirven: crea una nueva cuenta.
3. Para probar en tu máquina con cartera, usa un túnel y `BETTER_AUTH_URL`.

**Prompt listo**
```text
Al crear la cartera me pide una passkey que no aparece. Compara BETTER_AUTH_URL con el dominio
desde el que abro la app y dime si coinciden. No cambies el código de passkeys.
```

**Verificar:** la misma passkey abre la cartera en la misma URL, y en ninguna otra.

### 2.5 Carteras de Starknet (Bramble, Braavos, Ready)

**Qué es:** tu cartera propia. Sirve para iniciar sesión, para fondear la cartera de Vela y para retirar fondos. **No** es la cartera del agente: la del agente es la de Chipi, con los límites.

**Pasos**
1. Conecta tu cartera con **Sign in with Starknet** desde la app.
2. Confirma que tu saldo está en **USDC nativo**: la dirección `0x033068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb`. **No** es USDC.e.
3. Envía a la cartera de Vela solo una cantidad de centavos para la primera prueba.

**Prompt listo**
```text
Quiero fondear mi cartera de Vela desde Braavos. Dime qué token debo enviar, a qué dirección
y cómo confirmo que es USDC nativo y no USDC.e. Busca la dirección en lib/config.ts.
```

**Verificar:** el saldo que muestra el dashboard coincide con el de tu cartera.

### 2.6 Voyager (explorador de Starknet)

**Qué es:** muestra transacciones, contratos y eventos de Starknet mainnet.

**Pasos**
1. Copia el tx hash de la decisión del agente (en el dashboard, actividad).
2. Búscalo en Voyager y revisa estado, función llamada y eventos.
3. Compara la función con la lista `SESSION_ENTRYPOINTS` (`lib/config.ts`).

**Prompt listo**
```text
Este tx hash es de una decisión de mi agente: <hash>. Explícame qué función llamó, con qué
argumentos y si cae dentro de SESSION_ENTRYPOINTS. Si no tienes acceso a la red, dime qué
campos debo copiar de Voyager para que lo revisemos.
```

**Verificar:** el estado del tx es "accepted" (o equivalente) y coincide con el registro del dashboard.

### 2.7 Nodo RPC de Starknet

**Qué es:** el punto de acceso que lee la cadena. Por defecto Vela usa el nodo público de Cartridge.

**Pasos**
1. Si el nodo público limita tus consultas, crea un endpoint propio y pon `STARKNET_RPC_URL` (servidor) y `NEXT_PUBLIC_STARKNET_RPC_URL` (navegador).
2. Reinicia el servidor de desarrollo o redespliega.

**Prompt listo**
```text
Veo errores de límite de peticiones al leer saldos. Revisa lib/portfolio.ts y lib/starknet-wallet.ts
para ver dónde se usa el RPC y dime qué variable de entorno cambia cada parte.
```

**Verificar:** el dashboard carga saldos sin errores de red en la consola.

### 2.8 Vesu y AVNU (lo que hace el agente)

**Qué es:** Vesu es el mercado de préstamos donde el agente deposita USDC en una bóveda. AVNU es el agregador de intercambios que usa para cambiar tokens. Ambos se llaman desde la sesión, no a mano.

**Pasos**
1. La bóveda es `VESU_USDC_VAULT` y el router es `VESU_ROUTER` en `lib/config.ts`. No uses la dirección de la SDK (`VESU_USDC_MAINNET`): es USDC.e.
2. Para ver una posición, mira `lib/vesu.ts`.

**Prompt listo**
```text
Explícame, sin inventar nada, cómo el agente deposita USDC en Vesu: qué llamadas arma en
lib/vesu.ts, qué función del router se usa y por qué no se usa la función de la bóveda.
Cita archivo:línea.
```

**Verificar:** las llamadas del agente usan `deposit_to_self` y `withdraw_to_self`.

### 2.9 Chipi AI API (las decisiones del agente)

**Qué es:** `sdk.ai.think` propone una decisión. `decide()` en `lib/policy.ts` la aprueba o la rechaza.

**Prompt listo**
```text
Quiero añadir una señal nueva al prompt de lib/brain.ts. Muéstrame el cambio, y después
confirma que el resultado sigue pasando por decide() en lib/agent.ts antes de cualquier tx.
Si la nueva señal puede hacer que el agente gaste más de los límites, dilo.
```

**Verificar:** `npm test` pasa y el dashboard muestra la decisión con su motivo.

### 2.10 GitHub (tu copia del repo)

**Pasos**
1. Haz un fork o usa el botón de despliegue (que crea una copia en tu GitHub).
2. Trabaja en una rama nueva, no en `main`.
3. Revisa tu diff antes de subirlo.

**Prompt listo**
```text
Resume mi diff de esta rama contra main en una lista de archivos cambiados, con qué hace cada
cambio y qué módulo de course/ se ve afectado. No hagas commit todavía.
```

---

## Cómo mantenerla

- Si cambias un archivo que un módulo del curso cita, actualiza también el módulo (regla de `CLAUDE.md`).
- Si una receta deja de funcionar, corrígela en esta misma guía con el mismo formato.
- Agrega recetas nuevas al final de la plataforma que corresponda, o una sección nueva si aparece otra.
