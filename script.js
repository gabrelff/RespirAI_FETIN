// 1. CONFIGURAÇÃO E GERENCIAMENTO DO WEBSOCKET

const ESP32_IP = window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? window.location.hostname
    : '192.168.4.1'; // IP padrão do ESP32 em modo Access Point

const gateway = `ws://${ESP32_IP}:81/`;
let websocket = null;
let isMicrocontrollerOnline = false;

// Estado da Sessão de Captura
let isCapturing = false;
let captureTimerInterval = null;
const TEMPO_CAPTURA_MS = 5000; // 5 segundos de janela de sopro

// Inicia a tentativa de conexão WebSocket ao carregar
window.addEventListener('load', () => {
    initWebSocket();
});

function initWebSocket() {
    console.log(`[RespirAI] Conectando ao ESP32 via WebSocket em: ${gateway}`);

    try {
        websocket = new WebSocket(gateway);

        websocket.onopen = onOpen;
        websocket.onclose = onClose;
        websocket.onmessage = onMessage;
        websocket.onerror = onError;
    } catch (e) {
        console.warn('[RespirAI] Falha ao criar WebSocket:', e);
        setMicrocontrollerStatus(false);
    }
}

// 1. Quando o ESP32 aceita a conexão
function onOpen(event) {
    console.log('[RespirAI] Conectado ao ESP32 com sucesso!');
    setMicrocontrollerStatus(true);
}

// 2. Quando o ESP32 envia os dados consolidados após a captura de 5s
function onMessage(event) {
    if (!isMicrocontrollerOnline) {
        setMicrocontrollerStatus(true);
    }

    try {
        const payload = JSON.parse(event.data);
        console.log('[RespirAI] Dados recebidos do ESP32:', payload);

        // Se o teste foi acionado pelo botão físico no ESP32, encerra a animação do frontend
        finalizarSessaoCaptura();

        // Processa os dados brutos e diagnóstico
        processarDadosRecebidos(payload);

    } catch (erro) {
        console.error('[RespirAI] Erro ao processar JSON do ESP32:', erro, event.data);
    }
}

// 3. Quando a conexão cai
function onClose(event) {
    console.log('[RespirAI] Conexão com ESP32 perdida. Tentando reconectar em 2 segundos...');
    setMicrocontrollerStatus(false);
    setTimeout(initWebSocket, 2000);
}

// 4. Erro de comunicação
function onError(event) {
    console.warn('[RespirAI] Erro na comunicação WebSocket com o ESP32.');
    setMicrocontrollerStatus(false);
}

// 2. CONTROLE DO TESTE DE SOPRO (BOTÃO START & CRONÔMETRO)

// Disparado ao clicar no botão "Iniciar Teste de Sopro"
function iniciarTesteSopro() {
    if (isCapturing) return;

    isCapturing = true;
    atualizarUIParaCapturando();

    // Envia o comando "START" para o ESP32 via WebSocket
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        try {
            websocket.send('START');
            console.log('[RespirAI] Comando START enviado via WebSocket.');
        } catch (err) {
            console.warn('[RespirAI] Erro ao enviar comando START:', err);
        }
    } else {
        console.log('[RespirAI] ESP32 não conectado. Rodando em modo de simulação local.');
    }

    // Dispara a animação da barra e contagem regressiva de 5 segundos no frontend
    const tempoInicio = Date.now();
    const btnStart = document.getElementById('btn-start');
    const timerElem = document.getElementById('timer-countdown');
    const progressFill = document.getElementById('progress-bar-fill');

    if (btnStart) btnStart.disabled = true;

    if (captureTimerInterval) clearInterval(captureTimerInterval);

    captureTimerInterval = setInterval(() => {
        const tempoDecorrido = Date.now() - tempoInicio;
        const tempoRestante = Math.max(0, TEMPO_CAPTURA_MS - tempoDecorrido);
        const progressoPct = Math.min(100, (tempoDecorrido / TEMPO_CAPTURA_MS) * 100);

        if (timerElem) {
            timerElem.textContent = (tempoRestante / 1000).toFixed(1) + 's';
        }

        if (progressFill) {
            progressFill.style.width = `${progressoPct}%`;
        }

        if (tempoDecorrido >= TEMPO_CAPTURA_MS) {
            clearInterval(captureTimerInterval);
            captureTimerInterval = null;

            // Se estiver sem conexão física com o ESP32, gera simulação automática
            if (!isMicrocontrollerOnline || !websocket || websocket.readyState !== WebSocket.OPEN) {
                setTimeout(() => {
                    gerarLeituraSimulada();
                    finalizarSessaoCaptura();
                }, 300);
            } else {
                // Aguarda o JSON final do ESP32
                const statusBadge = document.getElementById('test-status-badge');
                if (statusBadge) {
                    statusBadge.className = 'status-badge status-idle';
                    statusBadge.textContent = 'Processando análise...';
                }
            }
        }
    }, 50);
}

function atualizarUIParaCapturando() {
    const statusBadge = document.getElementById('test-status-badge');
    const hintElem = document.getElementById('test-hint');
    const progressFill = document.getElementById('progress-bar-fill');

    if (statusBadge) {
        statusBadge.className = 'status-badge status-blowing';
        statusBadge.textContent = 'Soprando no sensor (5s)...';
    }

    if (hintElem) {
        hintElem.textContent = 'Mantenha um sopro contínuo e firme no bocal até o término do cronômetro.';
    }

    if (progressFill) {
        progressFill.style.width = '0%';
    }

    // Reseta temporariamente os cards para indicar nova leitura
    ['NH3', 'C2H5OH', 'H2', 'CO'].forEach(gas => {
        const elem = document.getElementById(`val-${gas}`);
        if (elem) elem.innerText = '...';
    });
}

function finalizarSessaoCaptura() {
    isCapturing = false;
    if (captureTimerInterval) {
        clearInterval(captureTimerInterval);
        captureTimerInterval = null;
    }

    const btnStart = document.getElementById('btn-start');
    const statusBadge = document.getElementById('test-status-badge');
    const timerElem = document.getElementById('timer-countdown');
    const hintElem = document.getElementById('test-hint');
    const progressFill = document.getElementById('progress-bar-fill');

    if (btnStart) btnStart.disabled = false;
    if (timerElem) timerElem.textContent = '5.0s';
    if (progressFill) progressFill.style.width = '100%';

    if (statusBadge) {
        statusBadge.className = 'status-badge status-done';
        statusBadge.textContent = 'Leitura Concluída';
    }

    if (hintElem) {
        hintElem.textContent = 'Teste concluído! Os resultados e a triagem diagnóstica foram atualizados abaixo.';
    }
}

// 3. PROCESSAMENTO DE DADOS & DIAGNÓSTICO CLÍNICO

// Processa a mensagem JSON recebida do ESP32
// Suporta a estrutura oficial do respirai_firmware.ino
function processarDadosRecebidos(dados) {
    // 1. Extração dos Dados Brutos (Picos dos gases)
    const brutos = dados.DadosBrutos || dados;

    const valNH3 = brutos.NH3 !== undefined ? brutos.NH3 : 0;
    const valC2H5OH = brutos.VOC_Proxy !== undefined ? brutos.VOC_Proxy : (brutos.C2H5OH !== undefined ? brutos.C2H5OH : 0);
    const valH2 = brutos.H2 !== undefined ? brutos.H2 : 0;
    const valCO = brutos.CO !== undefined ? brutos.CO : 0;

    atualizarValorGas('NH3', valNH3);
    atualizarValorGas('C2H5OH', valC2H5OH);
    atualizarValorGas('H2', valH2);
    atualizarValorGas('CO', valCO);

    // 2. Extração ou Cálculo do Diagnóstico IA
    const diag = dados.DiagnosticoIA || calcularDiagnosticoLocal(valNH3, valC2H5OH, valH2, valCO);

    atualizarPainelDiagnostico(diag);
}

// Atualiza o valor exibido no card do respectivo gás
function atualizarValorGas(gas, valor) {
    const elem = document.getElementById(`val-${gas}`);
    if (elem) {
        if (typeof valor === 'number') {
            elem.innerText = Number.isInteger(valor) ? valor.toString() : valor.toFixed(2);
        } else {
            elem.innerText = valor;
        }
    }
}

// Atualiza os cartões de diagnóstico e o status consolidado
function atualizarPainelDiagnostico(diag) {
    // Status individuais
    atualizarBadgeDiagnostico('diag-nh3', diag.Status_NH3 || 'Normal');
    atualizarBadgeDiagnostico('diag-c2h5oh', diag.Status_Acetona || 'Normal');
    atualizarBadgeDiagnostico('diag-h2', diag.Status_H2 || 'Normal');
    atualizarBadgeDiagnostico('diag-co', diag.Status_Isopreno || 'Normal');

    // Status Geral Consolidado
    const statusGeralBadge = document.getElementById('status-geral-badge');
    if (!statusGeralBadge) return;

    const alertas = [];
    if (diag.Status_NH3 && diag.Status_NH3 !== 'Normal') alertas.push('Sobrecarga Renal');
    if (diag.Status_Acetona && diag.Status_Acetona !== 'Normal') alertas.push('Risco Cetoacidose');
    if (diag.Status_H2 && diag.Status_H2 !== 'Normal') alertas.push('Alt. Microbioma');
    if (diag.Status_Isopreno && diag.Status_Isopreno !== 'Normal') alertas.push('Alerta Oncológico/VOC');

    if (alertas.length === 0) {
        statusGeralBadge.className = 'status-pill status-pill-normal';
        statusGeralBadge.textContent = 'Normal (0 Risco Detectado)';
    } else {
        statusGeralBadge.className = 'status-pill status-pill-danger';
        statusGeralBadge.textContent = `Atenção: ${alertas.join(' • ')}`;
    }
}

// Define o estilo (verde, amarelo, vermelho) de cada badge de diagnóstico
function atualizarBadgeDiagnostico(elementId, textoStatus) {
    const elem = document.getElementById(elementId);
    if (!elem) return;

    elem.textContent = textoStatus;

    if (textoStatus === 'Normal') {
        elem.className = 'diag-status-pill status-pill-normal';
    } else if (textoStatus.toLowerCase().includes('alt.') || textoStatus.toLowerCase().includes('atenção')) {
        elem.className = 'diag-status-pill status-pill-warning';
    } else {
        elem.className = 'diag-status-pill status-pill-danger';
    }
}

// Lógica de fallback para cálculo local de diagnóstico (idêntica ao respirai_firmware.ino)
function calcularDiagnosticoLocal(nh3, c2h5oh, h2, co) {
    let alertaRenal = "Normal";
    let alertaDiabetes = "Normal";
    let alertaGastro = "Normal";
    let alertaOncologico = "Normal";

    if (nh3 > 1.8) {
        alertaRenal = "Risco Renal (>1.8ppm)";
    }
    if (c2h5oh > 1.7) {
        alertaDiabetes = "Risco Cetoacidose (>1.7ppm)";
    }
    if (h2 > 7.0) {
        alertaGastro = "Alt. Microbioma (>7.0ppm)";
    }
    if (co > 0 && co < 0.09) {
        alertaOncologico = "Risco Suspeito (<0.09ppm)";
    }

    return {
        Status_NH3: alertaRenal,
        Status_Acetona: alertaDiabetes,
        Status_H2: alertaGastro,
        Status_Isopreno: alertaOncologico
    };
}

// 4. STATUS DO ESP32 & MODO DE SIMULAÇÃO LOCAL

function setMicrocontrollerStatus(online) {
    isMicrocontrollerOnline = !!online;

    const badge = document.getElementById('mcu-badge');
    const textElem = document.getElementById('mcu-status-text');

    if (!badge || !textElem) return;

    if (isMicrocontrollerOnline) {
        badge.classList.remove('mcu-offline');
        badge.classList.add('mcu-online');
        textElem.textContent = 'Online';
        badge.setAttribute('title', 'ESP32 Conectado • Pronto para teste.');
    } else {
        badge.classList.remove('mcu-online');
        badge.classList.add('mcu-offline');
        textElem.textContent = 'Offline';
        badge.setAttribute('title', 'ESP32 Desconectado • Clique no botão Iniciar para testar em modo simulação.');
    }
}

// Gera leituras de demonstração realistas para teste sem o microcontrolador físico
function gerarLeituraSimulada() {
    const amostraSimulada = {
        DadosBrutos: {
            NH3: parseFloat((0.2 + Math.random() * 0.5).toFixed(2)),
            VOC_Proxy: parseFloat((0.4 + Math.random() * 0.6).toFixed(2)),
            H2: parseFloat((1.1 + Math.random() * 2.0).toFixed(2)),
            CO: parseFloat((0.15 + Math.random() * 0.3).toFixed(2))
        },
        DiagnosticoIA: {
            Status_NH3: "Normal",
            Status_Acetona: "Normal",
            Status_H2: "Normal",
            Status_Isopreno: "Normal"
        }
    };

    processarDadosRecebidos(amostraSimulada);
}

// Expõe globalmente para o HTML
window.iniciarTesteSopro = iniciarTesteSopro;
window.setMicrocontrollerStatus = setMicrocontrollerStatus;
window.initWebSocket = initWebSocket;

// Clique no badge de status do ESP32 para alternar modo online/offline de teste
document.addEventListener('DOMContentLoaded', () => {
    const badge = document.getElementById('mcu-badge');
    if (badge) {
        badge.addEventListener('click', () => {
            if (isMicrocontrollerOnline) {
                setMicrocontrollerStatus(false);
            } else {
                setMicrocontrollerStatus(true);
            }
        });
    }
});