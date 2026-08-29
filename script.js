/**
 * RespirAI - Controle do Sistema, Gráfico e Comunicação WebSocket com ESP32
 */

// ==========================================================================
// 1. CONFIGURAÇÃO E GERENCIAMENTO DO WEBSOCKET (ESP32)
// ==========================================================================

// Configuração do endereço WebSocket do ESP32
// Se a página estiver rodando dentro do próprio ESP ou servidor local, usa o hostname atual na porta 81.
// Caso esteja abrindo o arquivo localmente (file:// ou localhost), você pode definir o IP do ESP32 manualmente.
const ESP32_IP = window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? window.location.hostname
    : '192.168.4.1'; // IP padrão do ESP32 em modo Access Point (ou coloque o IP da sua rede Wi-Fi, ex: 192.168.1.100)

const gateway = `ws://${ESP32_IP}:81/`;
let websocket;
let isMicrocontrollerOnline = false;

// Inicia a tentativa de conexão WebSocket assim que a página carregar
window.addEventListener('load', () => {
    initWebSocket();
});
W
function initWebSocket() {
    console.log(`[RespirAI] Tentando conectar ao ESP32 em: ${gateway}`);

    try {
        websocket = new WebSocket(gateway);

        // Mapeia os 4 eventos principais do ciclo de vida do WebSocket
        websocket.onopen = onOpen;
        websocket.onclose = onClose;
        websocket.onmessage = onMessage;
        websocket.onerror = onError;
    } catch (e) {
        console.warn('[RespirAI] Falha ao inicializar WebSocket:', e);
        setMicrocontrollerStatus(false);
    }
}

// 1. Quando o ESP32 aceita a conexão
function onOpen(event) {
    console.log('[RespirAI] Conectado ao ESP32 com sucesso!');
    setMicrocontrollerStatus(true);
}

// 2. Quando o ESP32 envia dados do sensor para a página
function onMessage(event) {
    // console.log('[RespirAI] Dados recebidos do ESP32: ', event.data);

    if (!isMicrocontrollerOnline) {
        setMicrocontrollerStatus(true);
    }

    try {
        const dadoBruto = event.data.trim();

        // Cenário A: Dados em formato JSON (ex: {"fluxo": 65, "rpm": 16})
        if (dadoBruto.startsWith('{') && dadoBruto.endsWith('}')) {
            const dadosJson = JSON.parse(dadoBruto);
            if (dadosJson.fluxo !== undefined) {
                adicionarLeituraAoGrafico(Number(dadosJson.fluxo));
            }
            if (dadosJson.rpm !== undefined) {
                atualizarDisplayRpm(dadosJson.rpm);
            }
        }
        // Cenário B: Dados separados por vírgula (ex: "65,16" onde 65 é o fluxo e 16 é o RPM)
        else if (dadoBruto.includes(',')) {
            const partes = dadoBruto.split(',');
            const valorFluxo = parseFloat(partes[0]);
            const valorRpm = partes[1] ? parseFloat(partes[1]) : null;

            if (!isNaN(valorFluxo)) adicionarLeituraAoGrafico(valorFluxo);
            if (valorRpm !== null && !isNaN(valorRpm)) atualizarDisplayRpm(valorRpm);
        }
        // Cenário C: Apenas um número direto do sensor (ex: "54.2")
        else {
            const valorNumerico = parseFloat(dadoBruto);
            if (!isNaN(valorNumerico)) {
                adicionarLeituraAoGrafico(valorNumerico);
            }
        }
    } catch (erro) {
        console.error('[RespirAI] Erro ao processar dados do ESP32:', erro, event.data);
    }
}

// 3. Quando a conexão cai ou o ESP32 reinicia
function onClose(event) {
    console.log('[RespirAI] Conexão com ESP32 perdida. Tentando reconectar em 2 segundos...');
    setMicrocontrollerStatus(false);

    // Tenta reconectar automaticamente a cada 2 segundos
    setTimeout(initWebSocket, 2000);
}

// 4. Erro na comunicação
function onError(event) {
    console.warn('[RespirAI] Erro na comunicação WebSocket com ESP32.');
    setMicrocontrollerStatus(false);
}

// Função para enviar comandos para o ESP32 (caso queira ligar/desligar calibração, iniciar teste, etc.)
function enviarComandoESP(comando) {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.send(comando);
        console.log('[RespirAI] Comando enviado ao ESP32:', comando);
    } else {
        console.warn('[RespirAI] Não foi possível enviar comando: ESP32 desconectado.');
    }
}

// Expõe globalmente
window.enviarComandoESP = enviarComandoESP;
window.initWebSocket = initWebSocket;


// ==========================================================================
// 2. GERENCIAMENTO DE STATUS NA INTERFACE (ONLINE / OFFLINE)
// ==========================================================================

function setMicrocontrollerStatus(online, options = {}) {
    isMicrocontrollerOnline = !!online;

    const badge = document.getElementById('mcu-badge');
    const textElem = document.getElementById('mcu-status-text');

    if (!badge || !textElem) return;

    const deviceName = options.device || 'ESP32';
    const customText = options.text;

    if (isMicrocontrollerOnline) {
        badge.classList.remove('mcu-offline');
        badge.classList.add('mcu-online');
        textElem.textContent = customText || 'Online';
        badge.setAttribute('title', `${deviceName} Conectado e transmitindo dados via WebSocket.`);
    } else {
        badge.classList.remove('mcu-online');
        badge.classList.add('mcu-offline');
        textElem.textContent = customText || 'Offline';
        badge.setAttribute('title', `${deviceName} Desconectado / Tentando reconectar...`);
        atualizarDisplayRpm('--');
    }
}

window.setMicrocontrollerStatus = setMicrocontrollerStatus;

// Alternância rápida de teste/simulação ao clicar no badge
document.addEventListener('DOMContentLoaded', () => {
    const badge = document.getElementById('mcu-badge');
    if (badge) {
        badge.addEventListener('click', () => {
            setMicrocontrollerStatus(!isMicrocontrollerOnline);
        });
    }
});


// ==========================================================================
// 3. MONITOR GRÁFICO DO SINAL RESPIRATÓRIO (CHART.JS)
// ==========================================================================

const canvasElement = document.getElementById('graficoSinal');
let chartMestre = null;
const labelsTempo = [];
const dadosFluxo = [];
const MAX_PONTOS_GRAFICO = 80;

if (canvasElement) {
    const contexto = canvasElement.getContext('2d');

    chartMestre = new Chart(contexto, {
        type: 'line',
        data: {
            labels: labelsTempo,
            datasets: [{
                label: 'Intensidade Respiratória',
                data: dadosFluxo,
                borderColor: '#38bdf8',
                backgroundColor: 'rgba(56, 189, 248, 0.12)',
                borderWidth: 2.5,
                tension: 0.35,
                pointRadius: 0,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                y: {
                    min: 0,
                    max: 100,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#64748b',
                        font: { size: 11 }
                    }
                },
                x: {
                    display: false
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            }
        }
    });
}

/**
 * Adiciona um novo valor de sensor lido do ESP32 ao gráfico
 * @param {number} valor - Valor da intensidade/fluxo lido pelo sensor
 */
function adicionarLeituraAoGrafico(valor) {
    if (!chartMestre) return;

    labelsTempo.push('');
    dadosFluxo.push(valor);

    // Efeito de rolagem para esquerda (estilo monitor hospitalar de UTI)
    if (dadosFluxo.length > MAX_PONTOS_GRAFICO) {
        labelsTempo.shift();
        dadosFluxo.shift();
    }

    chartMestre.update();
}

/**
 * Atualiza o display de frequência respiratória (RPM)
 * @param {number|string} rpm - Valor de respirações por minuto
 */
function atualizarDisplayRpm(rpm) {
    const rpmElem = document.getElementById('displayRpm');
    if (rpmElem) {
        rpmElem.innerText = rpm;
    }
}