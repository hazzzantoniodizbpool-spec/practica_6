let conversationHistory = [];

async function sendMessage() {
  const inputField = document.getElementById('userInput');
  const chatBox = document.getElementById('chatBox');
  const sendBtn = document.getElementById('sendBtn');
  const text = inputField.value.trim();

  if (!text) return;

  // Ocultar la pantalla de bienvenida al enviar el primer mensaje
  const welcome = document.getElementById('welcome');
  if (welcome) welcome.style.display = 'none';

  // 1. Mostrar mensaje del usuario en la UI
  appendMessage(text, 'user');
  inputField.value = '';

  // Agregar al historial local
  conversationHistory.push({ role: 'user', content: text });

  // Deshabilitar input y botón mientras responde el agente
  inputField.disabled = true;
  if (sendBtn) sendBtn.disabled = true;
  const typing = showTyping();

  try {
    // 2. Enviar petición al Backend
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        history: conversationHistory.slice(0, -1) // Enviamos el historial previo
      })
    });

    const data = await response.json();
    typing.remove();

    if (data.reply) {
      // 3. Mostrar respuesta del agente en la UI
      appendMessage(data.reply, 'assistant');
      // Agregar respuesta al historial local
      conversationHistory.push({ role: 'assistant', content: data.reply });
    } else {
      appendMessage('Error: No se pudo obtener respuesta del servidor.', 'assistant', true);
    }
  } catch (error) {
    console.error('Error de red:', error);
    typing.remove();
    appendMessage('Error de conexión con el servidor.', 'assistant', true);
  } finally {
    // Rehabilitar input y botón
    inputField.disabled = false;
    if (sendBtn) sendBtn.disabled = false;
    inputField.focus();
    chatBox.scrollTop = chatBox.scrollHeight;
  }
}

function appendMessage(text, sender, isError = false) {
  const chatBox = document.getElementById('chatBox');

  const row = document.createElement('div');
  row.className = `row ${sender}`;

  const avatar = document.createElement('div');
  avatar.className = 'mini-avatar';
  avatar.textContent = sender === 'user' ? '🙂' : '🤖';

  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${sender}${isError ? ' error' : ''}`;
  messageDiv.textContent = text;

  row.appendChild(avatar);
  row.appendChild(messageDiv);
  chatBox.appendChild(row);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Indicador visual de "el agente está escribiendo..."
function showTyping() {
  const chatBox = document.getElementById('chatBox');
  const row = document.createElement('div');
  row.className = 'row assistant';
  row.innerHTML = '<div class="mini-avatar">🤖</div>' +
    '<div class="message assistant typing"><span></span><span></span><span></span></div>';
  chatBox.appendChild(row);
  chatBox.scrollTop = chatBox.scrollHeight;
  return row;
}

// Usar una de las sugerencias de la pantalla de bienvenida
function useSuggestion(button) {
  const inputField = document.getElementById('userInput');
  inputField.value = button.textContent.replace(/^\S+\s/, ''); // quitar el emoji inicial
  sendMessage();
}

// Reiniciar la conversación
function clearChat() {
  conversationHistory = [];
  const chatBox = document.getElementById('chatBox');
  const welcome = document.getElementById('welcome');
  chatBox.querySelectorAll('.row').forEach((row) => row.remove());
  if (welcome) welcome.style.display = '';
  document.getElementById('userInput').focus();
}

function handleKeyPress(event) {
  if (event.key === 'Enter') {
    sendMessage();
  }
}
