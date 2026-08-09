<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# PolloChat 🐔💬

App de mensajería y llamadas al estilo WhatsApp, construida con React + Vite + TypeScript.

## Funcionalidades

- Lista de chats con búsqueda, estado en línea, mensajes no leídos y última hora.
- Conversaciones con burbujas de mensaje, confirmaciones de lectura (✓✓), indicador de "escribiendo…" y stickers.
- Selector de stickers para enviar en el chat.
- Llamadas de voz y videollamadas con temporizador, silenciar/activar micrófono, cámara (vista previa real con tu webcam) y altavoz.
- Reacciones/stickers flotantes durante la llamada, tanto propias como del contacto.
- Llamadas entrantes simuladas para probar el flujo de aceptar/rechazar.
- Modo claro/oscuro persistente.
- Respuestas de los contactos generadas con Gemini (si configuras tu API key) o con un set de respuestas de reserva si no la configuras.

## Ejecutar en local

**Requisitos:** Node.js

1. Instala las dependencias:
   `npm install`
2. (Opcional) Define `GEMINI_API_KEY` en [.env.local](.env.local) con tu API key de Gemini para que los contactos respondan con IA.
3. Ejecuta la app:
   `npm run dev`
