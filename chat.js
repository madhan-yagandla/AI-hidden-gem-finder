/**
 * Chat Module — AI chatbot for natural language hidden gem discovery
 */

import { showToast } from './ui.js';

let chatHistory = [];
let isOpen = false;
let onSearchFromChat = null; // callback to trigger search from chat intent
let autoReadResponse = false;
let recognition = null;

/**
 * Initialize the chatbot
 * @param {Function} searchCallback - function(intent) to trigger a search from chat
 */
export function initChat(searchCallback) {
  onSearchFromChat = searchCallback;

  const fab = document.getElementById('chat-fab');
  const panel = document.getElementById('chat-panel');
  const closeBtn = document.getElementById('chat-close-btn');
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send-btn');

  if (!fab) return;

  fab.addEventListener('click', () => toggleChat());
  closeBtn.addEventListener('click', () => {
    toggleChat(false);
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    if (recognition) recognition.stop();
  });

  sendBtn.addEventListener('click', () => {
    autoReadResponse = false;
    sendMessage();
  });
  
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      autoReadResponse = false;
      sendMessage();
    }
  });

  initVoiceAssistant();

  // Add welcome message
  addBotMessage("Hey there! 👋 I'm **Gem Guide**, your AI travel buddy!\n\nTell me what kind of places you're looking for.\n\nTry something like:\n• *\"Show me peaceful nature spots in Jaipur\"*\n• *\"I want to find art galleries in Delhi\"*\n• *\"Hidden food gems near Mumbai\"*");
}

function toggleChat(forceState) {
  const panel = document.getElementById('chat-panel');
  const fab = document.getElementById('chat-fab');

  isOpen = forceState !== undefined ? forceState : !isOpen;
  panel.classList.toggle('open', isOpen);
  fab.classList.toggle('hidden', isOpen);

  if (isOpen) {
    setTimeout(() => document.getElementById('chat-input')?.focus(), 300);
  }
}

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;

  const isSpeechTriggered = autoReadResponse;
  autoReadResponse = false;

  input.value = '';
  addUserMessage(text);

  // Show typing indicator
  const typingId = addTypingIndicator();

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        history: chatHistory.slice(-8),
      }),
    });

    if (!response.ok) throw new Error('Chat failed');
    const data = await response.json();

    removeTypingIndicator(typingId);

    // Add bot reply
    addBotMessage(data.reply);

    if (isSpeechTriggered) {
      speakText(data.reply);
    }

    // If there are search results from the chat
    if (data.gems && data.gems.length > 0) {
      addGemResults(data.gems);

      // Trigger the main search UI to show these on the map too
      if (data.intent && onSearchFromChat) {
        onSearchFromChat(data.intent, data.gems);
      }
    }

    // Update conversation history
    chatHistory.push(
      { role: 'user', parts: [{ text }] },
      { role: 'model', parts: [{ text: data.reply }] }
    );

  } catch (error) {
    removeTypingIndicator(typingId);
    addBotMessage("Oops, something went wrong! Try again or use the search panel. 😅");
  }
}

function addUserMessage(text) {
  const container = document.getElementById('chat-messages');
  const msg = document.createElement('div');
  msg.className = 'chat-message user';
  msg.innerHTML = `<div class="chat-bubble user">${escapeHtml(text)}</div>`;
  container.appendChild(msg);
  scrollToBottom();
}

function addBotMessage(text) {
  const container = document.getElementById('chat-messages');
  const msg = document.createElement('div');
  msg.className = 'chat-message bot';
  msg.innerHTML = `
    <div class="chat-avatar">💎</div>
    <div class="chat-bubble bot">${formatMarkdown(text)}</div>
  `;
  container.appendChild(msg);
  scrollToBottom();
}

function addGemResults(gems) {
  const container = document.getElementById('chat-messages');
  const msg = document.createElement('div');
  msg.className = 'chat-message bot';

  const cardsHtml = gems.slice(0, 5).map((gem) => {
    const scoreLabel = gem.gemScore >= 75 ? '🔥 Top Gem' : gem.gemScore >= 50 ? '💎 Hidden Gem' : '📍 Worth a Visit';
    return `
    <div class="chat-gem-card">
      <div style="position: relative;">
        <img class="chat-gem-img" src="${gem.imageUrl || `https://picsum.photos/seed/${encodeURIComponent(gem.name)}/400/200`}" alt="${gem.name}" loading="lazy" onerror="this.style.display='none';" />
        <div style="position: absolute; bottom: 8px; right: 8px; font-size: 0.75em; font-weight: bold; background: rgba(0,0,0,0.6); color: white; padding: 2px 6px; border-radius: 12px; backdrop-filter: blur(4px);">
          ${scoreLabel}
        </div>
      </div>
      <div class="chat-gem-info">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
          <div class="chat-gem-name" style="margin-bottom: 0;">${gem.category.icon} ${gem.name}</div>
          <div class="gem-card-rating" style="font-size: 0.8em; font-weight: 600; color: var(--text-accent); display: flex; align-items: center; gap: 4px; background: rgba(251, 191, 36, 0.15); padding: 2px 6px; border-radius: 6px;">⭐ ${(gem.gemScore / 20).toFixed(1)}</div>
        </div>
        <div class="chat-gem-desc">${gem.aiDescription || ''}</div>
        ${gem.gemReason ? `<div class="chat-gem-reason" style="font-size: 0.85em; color: var(--accent-amber); background: var(--accent-amber-glow); padding: 4px 8px; border-radius: 4px; border-left: 2px solid var(--accent-amber); margin-top: 6px; margin-bottom: 6px; line-height: 1.4;">💎 ${gem.gemReason}</div>` : ''}
        ${gem.travel?.distanceFormatted ? `<div class="chat-gem-travel">${gem.travel.modeIcon} ${gem.travel.distanceFormatted} · ~${gem.travel.durationFormatted}</div>` : ''}
        ${gem.comfort ? `<div class="chat-gem-comfort">${gem.comfort.comfortIcon} ${gem.comfort.comfortLevel} · ${gem.comfort.audienceIcon} ${gem.comfort.audience}</div>` : ''}
        ${gem.bestTime ? `<div class="chat-gem-time" style="font-size: 0.85em; color: var(--text-tertiary); margin-top: 6px; display: flex; align-items: center; gap: 4px;">🕐 ${gem.bestTime}</div>` : ''}
      </div>
    </div>
  `;
  }).join('');

  msg.innerHTML = `
    <div class="chat-avatar">💎</div>
    <div class="chat-gem-results">${cardsHtml}</div>
  `;
  container.appendChild(msg);
  scrollToBottom();
}

function addTypingIndicator() {
  const container = document.getElementById('chat-messages');
  const id = 'typing-' + Date.now();
  const msg = document.createElement('div');
  msg.className = 'chat-message bot';
  msg.id = id;
  msg.innerHTML = `
    <div class="chat-avatar">💎</div>
    <div class="chat-bubble bot typing">
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
    </div>
  `;
  container.appendChild(msg);
  scrollToBottom();
  return id;
}

function removeTypingIndicator(id) {
  document.getElementById(id)?.remove();
}

function scrollToBottom() {
  const container = document.getElementById('chat-messages');
  setTimeout(() => { container.scrollTop = container.scrollHeight; }, 50);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

function initVoiceAssistant() {
  const micBtn = document.getElementById('chat-mic-btn');
  const input = document.getElementById('chat-input');
  if (!micBtn) return;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    micBtn.style.display = 'none'; // Hide if not supported
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-IN';

  let isListening = false;
  let originalPlaceholder = '';

  const stopListening = () => {
    if (!isListening) return;
    isListening = false;
    micBtn.classList.remove('listening');
    input.placeholder = originalPlaceholder;
    recognition.stop();
  };

  micBtn.addEventListener('click', () => {
    if (isListening) {
      stopListening();
      return;
    }

    try {
      recognition.start();
      isListening = true;
      micBtn.classList.add('listening');
      originalPlaceholder = input.placeholder;
      input.placeholder = "Listening... (Tap mic to send)";
      input.value = '';
      autoReadResponse = true; // Set flag to read next response
      
      // Stop any currently playing speech synthesized message
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    } catch (e) {
      console.error(e);
      showToast('Microphone access denied or error', 'error');
    }
  });

  recognition.onresult = (event) => {
    const transcript = Array.from(event.results)
      .map(result => result[0])
      .map(result => result.transcript)
      .join('');
    input.value = transcript;
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error', event.error);
    stopListening();
    if (event.error !== 'aborted' && event.error !== 'no-speech') {
      showToast(`Microphone error: ${event.error}`, 'error');
    }
  };

  recognition.onend = () => {
    if (isListening) {
      isListening = false;
      micBtn.classList.remove('listening');
      input.placeholder = originalPlaceholder;
    }
    
    if (input.value.trim() !== '' && autoReadResponse) {
      sendMessage();
    }
  };
}

function speakText(text) {
  if (!('speechSynthesis' in window)) return;
  // Cancel any ongoing speech
  window.speechSynthesis.cancel();
  
  // Clean markdown for speech
  const cleanText = text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/#/g, '')
    .replace(/---INTENT---.*/s, '') // remove intent part if any
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1'); // markdown links
    
  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = 'en-US';
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  window.speechSynthesis.speak(utterance);
}
