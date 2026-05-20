# EcoTransport

Aplicacion Vite + React para simular acomodo de carga con enfoque sustentable: mejor cubica, menos viajes, menor consumo de combustibles fosiles y reduccion de CO2 operativo.

Nombre oficial del proyecto segun la memoria InnovaTecNM: **ECOTRANSPORT**.

## Requisitos

- Node.js 20 o superior
- Una API key de Gemini para recomendaciones de IA
- Una API key de Google Maps si se quiere usar el planificador de ruta
- Proyecto de Supabase para autenticacion y persistencia de cargas

## Variables de entorno

Crea un archivo `.env.local` en la raiz del proyecto:

```env
GEMINI_API_KEY=tu_api_key_de_gemini
VITE_GOOGLE_MAPS_API_KEY=tu_api_key_de_google_maps
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key_publica
```

`VITE_GOOGLE_MAPS_API_KEY` es opcional. Si falta, la app muestra un aviso en el modulo de rutas y el resto del simulador sigue funcionando.
`VITE_SUPABASE_URL` debe ser la URL base del proyecto, no la ruta `/rest/v1/`.

## Supabase

El cliente Supabase esta en `services/supabaseClient.ts`.

Para crear la base inicial:

1. Abre Supabase SQL Editor.
2. Ejecuta el script `supabase/schema.sql`.
3. Activa/valida Auth con email y password.
4. Mantén `service_role` fuera del frontend; la app solo usa la anon key publica.

## Desarrollo

```bash
npm install
npm run dev
```

La app se sirve por defecto en `http://localhost:3000`.

## Validacion

```bash
npm run lint
npm run build
```

## Notas para continuar en esta plataforma

- Tailwind esta configurado localmente con `tailwind.config.js`, `postcss.config.js` e `index.css`; ya no depende del CDN.
- Las dependencias se resuelven desde `package.json`; se elimino el `importmap` heredado de AI Studio.
- El proyecto no estaba inicializado como repositorio Git al momento de la adecuacion.
- Cuenta configurada visualmente: Ismael, `ireyes@NEMFIS.MX`.
