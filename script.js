/**
 * RespirAI - Controle do Sistema & Status do Microcontrolador
 */

// ==========================================================================
// 1. GERENCIAMENTO DE STATUS DO MICROCONTROLADOR (ONLINE / OFFLINE)
// ==========================================================================
let isMicrocontrollerOnline = true;

/**
 * Atualiza o status de conexão do microcontrolador na interface.
 * @param {boolean} online - true para Conectado/Online, false para Desconectado/Offline
 * @param {object} [options] - Opções adicionais (ex: nome do dispositivo, mensagem customizada)
 */
function setMicrocontrollerStatus(online, options = {}) {
    isMicrocontrollerOnline = !!online;

    const badge = document.getElementById('mcu-badge');
    const textElem = document.getElementById('mcu-status-text');
    const dotElem = document.getElementById('mcu-dot');

    if (!badge || !textElem) return;

    const deviceName = options.device || 'ESP32';
    const customText = options.text;

    if (isMicrocontrollerOnline) {
        badge.classList.remove('mcu-offline');
        badge.classList.add('mcu-online');
        textElem.textContent = customText || 'Online';
        badge.setAttribute('title', `${deviceName} Conectado e transmitindo dados em tempo real. (Clique para alternar teste)`);
    } else {
        badge.classList.remove('mcu-online');
        badge.classList.add('mcu-offline');
        textElem.textContent = customText || 'Offline';
        badge.setAttribute('title', `${deviceName} Desconectado / Sem sinal do sensor. (Clique para alternar teste)`);
    }

    console.log(`[RespirAI] Status do microcontrolador: ${isMicrocontrollerOnline ? 'ONLINE' : 'OFFLINE'}`);
}

// Expõe no escopo global para facilitar integração com WebSockets, MQTT ou APIs
window.setMicrocontrollerStatus = setMicrocontrollerStatus;

// Alternância rápida de teste ao clicar no badge de status
document.addEventListener('DOMContentLoaded', () => {
    const badge = document.getElementById('mcu-badge');
    if (badge) {
        badge.addEventListener('click', () => {
            setMicrocontrollerStatus(!isMicrocontrollerOnline);
        });
    }

    // Inicializa painel de cadastro se estiver na página de registros
    initPatientPanel();
});


// ==========================================================================
// 2. MONITOR GRÁFICO DO SINAL RESPIRATÓRIO (PAINEL CLÍNICO)
// ==========================================================================
const canvasElement = document.getElementById('graficoSinal');

if (canvasElement) {
    const contexto = canvasElement.getContext('2d');

    // Arrays de dados do gráfico
    const labelsTempo = [];
    const dadosFluxo = [];

    const chartMestre = new Chart(contexto, {
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

    let tempoSimulado = 0;

    // Atualização em tempo real (dados simulados do ESP32)
    setInterval(() => {
        let leitura;

        if (isMicrocontrollerOnline) {
            // Simulação de fluxo respiratório com leve ruído de sensor
            const onda = Math.sin(tempoSimulado) * 35;
            const ruido = (Math.random() - 0.5) * 6;
            leitura = Math.round(50 + onda + ruido);
            tempoSimulado += 0.15;
        } else {
            // Sinal em repouso / flatline quando o microcontrolador está offline
            leitura = 0;
        }

        labelsTempo.push('');
        dadosFluxo.push(leitura);

        // Deslocamento para esquerda estilo monitor hospitalar
        if (dadosFluxo.length > 80) {
            labelsTempo.shift();
            dadosFluxo.shift();
        }

        chartMestre.update();

        // Atualização do valor de RPM
        const rpmElem = document.getElementById('displayRpm');
        if (rpmElem) {
            if (isMicrocontrollerOnline) {
                rpmElem.innerText = Math.floor(Math.random() * 3) + 15;
            } else {
                rpmElem.innerText = '--';
            }
        }

    }, 150);
}