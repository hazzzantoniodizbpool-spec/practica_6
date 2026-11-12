# Práctica 6: Integrar un Agente IA en un Aplicativo Web

Aplicación web cliente-servidor desacoplada que integra un agente de Inteligencia Artificial utilizando **Node.js con Express** como backend seguro y **OpenRouter** (`openai/gpt-4o-mini`) como pasarela de modelos LLM.

---

## 📁 Estructura del Proyecto

```text
practica_6/
├── ai-backend/
│   ├── .env.example       # Plantilla de variables de entorno
│   ├── .gitignore         # Exclusión de credenciales y dependencias
│   ├── package.json       # Dependencias del servidor (express, cors, dotenv, openai)
│   └── server.js          # Servidor Express y endpoint POST /api/chat
│
├── ai-frontend/
│   ├── index.html         # Interfaz moderna de chat web
│   └── app.js             # Lógica cliente, peticiones fetch e historial
│
├── PLAN_IMPLEMENTACION_PRACTICA_6.md # Plan de implementación y casos de prueba
└── README.md
```

---

## 🚀 Requisitos Previos

- [Node.js](https://nodejs.org/) v18 o superior.
- Clave de API de [OpenRouter](https://openrouter.ai/).

---

## ⚙️ Instalación y Configuración

### 1. Configurar Backend

1. Entra a la carpeta del backend:
   ```bash
   cd ai-backend
   ```
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Crea un archivo `.env` a partir del ejemplo:
   ```bash
   cp .env.example .env
   ```
4. Abre `.env` y configura tu clave de OpenRouter:
   ```ini
   PORT=3000
   OPENROUTER_API_KEY=tu_api_key_de_openrouter_aqui
   ```
5. Inicia el servidor:
   ```bash
   node server.js
   ```
   Verás en consola: `Servidor corriendo en puerto 3000`.

---

## 💻 Ejecución del Frontend

1. Abre el archivo `ai-frontend/index.html` directamente en tu navegador web favorito (Chrome, Edge, Firefox, etc.) haciendo doble clic sobre él o mediante `file://`.
2. Escribe tu mensaje en la caja de texto o selecciona una de las sugerencias iniciales.
3. El agente responderá en tiempo real manteniendo el contexto de la conversación.

---

## 🧪 Pruebas Realizadas

- **Inicio del Servidor**: Servidor Express escuchando en puerto 3000.
- **Validación de Entradas**: Verificación de campos obligatorios (`message`).
- **Inferencia LLM**: Comunicación exitosa con modelo `openai/gpt-4o-mini`.
- **Memoria Contextual**: Mantenimiento del historial conversacional en peticiones consecutivas.
