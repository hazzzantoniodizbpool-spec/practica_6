const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { OpenAI } = require('openai');
const mysql = require('mysql2/promise');

const app = express();
app.use(express.json());
app.use(cors());

// Pool de conexiones a la base de datos Sakila en MySQL (Laragon)
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3307,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sakila',
  waitForConnections: true,
  connectionLimit: 10,
  multipleStatements: false,
});

// Inicializar el cliente de OpenAI apuntando a la baseURL de OpenRouter
const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'https://tu-sitio-web.com',
    'X-Title': 'Agente IA Sakila',
  },
});

const SYSTEM_PROMPT = `Eres un analista de datos experto conectado en tiempo real a la base de datos MySQL "sakila" (una cadena de videoclubes/tiendas de alquiler de películas).
Siempre que el usuario haga preguntas sobre películas, clientes, alquileres, pagos, tiendas o tendencias, DEBES usar la herramienta "consultar_sakila" para ejecutar consultas SQL reales antes de responder. Nunca inventes cifras, nombres ni resultados.

Esquema principal de sakila:
- film (film_id, title, description, release_year, language_id, rental_duration, rental_rate, length, replacement_cost, rating, special_features) — Nota: "length" está en minutos (> 120 significa más de 2 horas).
- category (category_id, name) y film_category (film_id, category_id) — Por ejemplo, name = 'Action'.
- actor (actor_id, first_name, last_name) y film_actor (actor_id, film_id).
- inventory (inventory_id, film_id, store_id).
- rental (rental_id, rental_date, inventory_id, customer_id, return_date, staff_id).
- payment (payment_id, customer_id, staff_id, rental_id, amount, payment_date).
- customer (customer_id, store_id, first_name, last_name, email, address_id, active, create_date).
- store (store_id, manager_staff_id, address_id), staff (staff_id, first_name, last_name, store_id), address, city, country.

Notas importantes para tus consultas SQL en MySQL 8:
1. SIEMPRE usa ORDER BY y LIMIT (por ejemplo LIMIT 10 o LIMIT 15) cuando busques rankings, máximos o extremos ("más alquiladas", "llevan más tiempo sin alquilar", etc.), porque la herramienta devuelve máximo 50 filas y sin ORDER BY devolvería registros arbitrarios.
2. Para popularidad o frecuencia de alquiler de películas, haz JOIN desde film -> inventory -> rental, agrupa por f.film_id y ordena por COUNT(r.rental_id) DESC. Recuerda que "más de 2 horas" significa f.length > 120.
3. Los registros históricos de Sakila son de 2005–2006. Cuando analices recencia o inactividad ("clientes que llevan mucho tiempo sin alquilar"), NO uses NOW() ni CURDATE(): compara MAX(r.rental_date) de cada cliente contra (SELECT MAX(rental_date) FROM rental) usando DATEDIFF, ordena por MAX(r.rental_date) ASC (los más antiguos primero) con LIMIT 15, e incluye también su estado active y total de alquileres.
4. En análisis por día de la semana, agrupa por DAYNAME(r.rental_date) y DAYOFWEEK(r.rental_date), ordena por total de alquileres DESC e incluye: COUNT(DISTINCT r.rental_id) (movimiento), SUM(p.amount) (recaudación total), ROUND(AVG(p.amount), 2) (promedio por pago/alquiler) y ROUND(SUM(p.amount) / COUNT(DISTINCT DATE(r.rental_date)), 2) (promedio por día calendario).
5. Responde siempre en español claro, bien estructurado y sustentado exclusivamente con los datos devueltos por tus consultas SQL.`;

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'consultar_sakila',
      description: 'Ejecuta una consulta SQL de solo lectura (SELECT, WITH, SHOW, DESCRIBE) en la base de datos MySQL sakila y devuelve hasta 50 filas.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Consulta SQL de solo lectura válida para MySQL 8.',
          },
        },
        required: ['query'],
      },
    },
  },
];

function validateReadOnlySql(rawQuery) {
  if (!rawQuery || typeof rawQuery !== 'string') {
    throw new Error('La consulta SQL debe ser una cadena de texto no vacía.');
  }
  const trimmed = rawQuery.trim().replace(/;+\s*$/, '');
  if (!trimmed) {
    throw new Error('La consulta SQL está vacía.');
  }
  if (trimmed.includes(';')) {
    throw new Error('Solo se permite una instrucción SQL por llamada.');
  }
  if (!/^(SELECT|WITH|SHOW|DESCRIBE|DESC|EXPLAIN)\b/i.test(trimmed)) {
    throw new Error('Solo se permiten consultas de solo lectura (SELECT, WITH, SHOW, DESCRIBE).');
  }
  if (/\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|REPLACE|GRANT|REVOKE|CALL|INTO\s+OUTFILE|INTO\s+DUMPFILE)\b/i.test(trimmed)) {
    throw new Error('La consulta contiene palabras clave de escritura o modificación no permitidas.');
  }
  return trimmed;
}

async function executeReadOnlyQuery(rawQuery) {
  const sql = validateReadOnlySql(rawQuery);
  const [rows] = await pool.query(sql);
  const allRows = Array.isArray(rows) ? rows : [rows];
  const maxRows = 50;
  return {
    totalRows: allRows.length,
    truncated: allRows.length > maxRows,
    rows: allRows.slice(0, maxRows),
  };
}

app.post('/api/chat', async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'El mensaje es requerido y debe ser texto.' });
    }

    const sanitizedHistory = Array.isArray(history)
      ? history
          .filter((item) => item && typeof item.content === 'string' && (item.role === 'user' || item.role === 'assistant'))
          .map((item) => ({ role: item.role, content: item.content }))
      : [];

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...sanitizedHistory,
      { role: 'user', content: message },
    ];

    let reply = '';
    const maxTurns = 5;

    for (let turn = 0; turn < maxTurns; turn++) {
      const completion = await openrouter.chat.completions.create({
        model: 'openai/gpt-4o-mini',
        messages,
        tools: TOOLS,
        tool_choice: 'auto',
      });

      const assistantMessage = completion.choices[0].message;
      messages.push(assistantMessage);

      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        reply = assistantMessage.content || '';
        break;
      }

      for (const toolCall of assistantMessage.tool_calls) {
        if (toolCall.function.name === 'consultar_sakila') {
          let resultContent;
          try {
            const args = JSON.parse(toolCall.function.arguments || '{}');
            const result = await executeReadOnlyQuery(args.query);
            resultContent = JSON.stringify(result);
          } catch (err) {
            resultContent = JSON.stringify({ error: err.message });
          }

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: resultContent,
          });
        }
      }
    }

    if (!reply) {
      const finalCompletion = await openrouter.chat.completions.create({
        model: 'openai/gpt-4o-mini',
        messages,
      });
      reply = finalCompletion.choices[0].message.content || 'No se pudo generar una respuesta.';
    }

    res.json({ reply });
  } catch (error) {
    console.error('Error al procesar la solicitud con Sakila / OpenRouter:', error);
    res.status(500).json({ error: 'Error interno al procesar la solicitud con la IA' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
