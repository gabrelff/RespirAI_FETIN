/**
 * RespirAR - Monitoramento Respiratório de Gases (ESP32 WebSockets)
 */

// ==========================================================================
// 1. CONFIGURAÇÃO E GERENCIAMENTO DO WEBSOCKET
// ==========================================================================

// Configuração do endereço WebSocket do ESP32
// Se a página estiver na memória do ESP32 (modo Access Point ou Wi-Fi), usa o hostname atual na porta 81.
// Em ambiente local (computador), usa o IP de fallback definido (192.168.4.1).
const ESP32_IP = window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? window.location.hostname 
    : '192.168.4.1'; // IP padrão do ESP32 em modo Access Point

const gateway = `ws://${ESP32_IP}:81/`;
let websocket = null;
let isMicrocontrollerOnline = false;

// Lista dos 6 gases monitorados
const GASES = ['CO', 'CH4', 'C2H5OH', 'H2', 'NH3', 'NO2'];

// Inicia a tentativa de conexão WebSocket assim que a página carregar
window.addEventListener('load', () => {
    initWebSocket();
});

function initWebSocket() {
    console.log(`[RespirAR] Conectando ao ESP32 via WebSocket em: ${gateway}`);
    
    try {
        websocket = new WebSocket(gateway);

        websocket.onopen    = onOpen;
        websocket.onclose   = onClose;
        websocket.onmessage = onMessage;
        websocket.onerror   = onError;
    } catch (e) {
        console.warn('[RespirAR] Falha ao criar WebSocket:', e);
        setMicrocontrollerStatus(false);
    }
}

// 1. Quando o ESP32 aceita a conexão
function onOpen(event) {
    console.log('[RespirAR] Conectado ao ESP32 com sucesso!');
    setMicrocontrollerStatus(true);
}

// 2. Quando o ESP32 envia os dados dos gases em formato JSON a cada 1 segundo
function onMessage(event) {
    if (!isMicrocontrollerOnline) {
        setMicrocontrollerStatus(true);
    }

    try {
        const dados = JSON.parse(event.data);

        // Atualiza a leitura de cada um dos 6 gases
        GASES.forEach(gas => {
            if (dados[gas] !== undefined) {
                atualizarValorGas(gas, dados[gas]);
            }
        });

    } catch (erro) {
        console.error('[RespirAR] Erro ao processar JSON do ESP32:', erro, event.data);
    }
}

// 3. Quando a conexão cai ou o ESP32 é desligado/reiniciado
function onClose(event) {
    console.log('[RespirAR] Conexão com ESP32 perdida. Tentando reconectar em 2 segundos...');
    setMicrocontrollerStatus(false);
    
    // Tenta reconectar automaticamente
    setTimeout(initWebSocket, 2000);
}

// 4. Erro de comunicação
function onError(event) {
    console.warn('[RespirAR] Erro na comunicação WebSocket com o ESP32.');
    setMicrocontrollerStatus(false);
}


// ==========================================================================
// 2. ATUALIZAÇÃO DA INTERFACE & LEITURAS EM PPM
// ==========================================================================

/**
 * Atualiza o valor exibido no card do respectivo gás
 * @param {string} gas - Identificador do gás (CO, CH4, C2H5OH, H2, NH3, NO2)
 * @param {number|string} valor - Concentração lida em PPM
 */
function atualizarValorGas(gas, valor) {
    const elem = document.getElementById(`val-${gas}`);
    if (elem) {
        if (typeof valor === 'number') {
            // Se for inteiro mostra normal, senão formata em até 2 casas decimais
            elem.innerText = Number.isInteger(valor) ? valor.toString() : valor.toFixed(2);
        } else {
            elem.innerText = valor;
        }
    }
}

/**
 * Atualiza o status de conexão no topo da tela
 * @param {boolean} online 
 */
function setMicrocontrollerStatus(online) {
    isMicrocontrollerOnline = !!online;

    const badge = document.getElementById('mcu-badge');
    const textElem = document.getElementById('mcu-status-text');

    if (!badge || !textElem) return;

    if (isMicrocontrollerOnline) {
        badge.classList.remove('mcu-offline');
        badge.classList.add('mcu-online');
        textElem.textContent = 'Online';
        badge.setAttribute('title', 'ESP32 Conectado • Leituras ativas em tempo real.');
    } else {
        badge.classList.remove('mcu-online');
        badge.classList.add('mcu-offline');
        textElem.textContent = 'Offline';
        badge.setAttribute('title', 'ESP32 Desconectado • Tentando reconectar...');

        // Reseta os valores dos 6 cards para '--' quando desconectado
        GASES.forEach(gas => {
            const elem = document.getElementById(`val-${gas}`);
            if (elem) elem.innerText = '--';
        });
    }
}

// Expõe globalmente
window.setMicrocontrollerStatus = setMicrocontrollerStatus;
window.initWebSocket = initWebSocket;

// Clique no badge para alternar/simular dados durante testes locais sem o ESP32 físico
document.addEventListener('DOMContentLoaded', () => {
    const badge = document.getElementById('mcu-badge');
    if (badge) {
        badge.addEventListener('click', () => {
            if (isMicrocontrollerOnline) {
                setMicrocontrollerStatus(false);
            } else {
                setMicrocontrollerStatus(true);
                // Simulação com os valores de exemplo do seu JSON
                atualizarValorGas('CO', 2.5);
                atualizarValorGas('CH4', 1.2);
                atualizarValorGas('C2H5OH', 0.4);
                atualizarValorGas('H2', 1.1);
                atualizarValorGas('NH3', 0.2);
                atualizarValorGas('NO2', 0.8);
            }
        });
    }
});