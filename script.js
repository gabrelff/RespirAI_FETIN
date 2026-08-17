const contexto = document.getElementById('graficoSinal').getContext('2d');

// Arrays (listas) que vão guardar os dados do gráfico
const labelsTempo = [];
const dadosFluxo = [];

// Configurando como o gráfico deve se parecer
const chartMestre = new Chart(contexto, {
    type: 'line',
    data: {
        labels: labelsTempo,
        datasets: [{
            label: 'Intensidade Respiratória',
            data: dadosFluxo,
            borderColor: '#3498db', // Cor da linha azul
            backgroundColor: 'rgba(52, 152, 219, 0.1)', // Preenchimento suave abaixo da linha
            borderWidth: 3,
            tension: 0.4, // Deixa a linha arredondada (suave) em vez de pontiaguda
            pointRadius: 0, // Esconde as "bolinhas" nos pontos de dados (melhor para visual de monitor)
            fill: true
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false, // Importante: desligar a animação padrão para atualizações rápidas fluírem bem
        scales: {
            y: {
                min: 0,
                max: 100, // Escala de 0 a 100 (você vai ajustar depois conforme o sensor do ESP32)
                grid: { color: '#f0f0f0' }
            },
            x: {
                display: false // Esconde os textos do eixo X para focar só na onda
            }
        },
        plugins: {
            legend: { display: false } // Esconde a legenda para ganhar espaço
        }
    }
});

// ==========================================
// SIMULAÇÃO DO ESP32 (Dados Falsos)
// ==========================================
let tempoSimulado = 0;

// A função setInterval executa um bloco de código repetidamente (neste caso, a cada 200 milissegundos)
setInterval(() => {
            
    // 1. Criando um dado falso parecido com respiração (uma onda senoidal matemática)
    const onda = Math.sin(tempoSimulado) * 35; // Altura da onda
    const ruido = Math.random() * 5; // Simula a imperfeição de um sensor real
    const leituraFalsa = Math.round(50 + onda + ruido); 

    // 2. Colocando o dado novo dentro do gráfico
    labelsTempo.push('');
    dadosFluxo.push(leituraFalsa);

    // 3. Efeito "Monitor de UTI": se passar de 100 pontos, removemos o mais velho
    // Isso faz o gráfico deslizar para a esquerda
    if (dadosFluxo.length > 100) {
        labelsTempo.shift(); // Remove o primeiro item do array de tempo
        dadosFluxo.shift();  // Remove o primeiro item do array de dados
    }

    // 4. Mandamos o Chart.js atualizar a tela com os novos dados
    chartMestre.update();
    
    // 5. Atualizando o cartão de RPM falso (um número aleatório entre 14 e 18)
    document.getElementById('displayRpm').innerText = Math.floor(Math.random() * 5) + 14;

    tempoSimulado += 0.15; // Avança o tempo para a onda continuar desenhando

}, 200); // 200ms significa que o gráfico recebe 5 dados por segundo