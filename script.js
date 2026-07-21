const pacientes = [
    {
        id: "0001",
        nome: "Gabriel Fonseca",
        idade: "29",
        email: "gabriel@qualquer.com",
        data: "30/05/2026",
        risco: "CRITICO",
        score: 87
    },
    {
        id: "0002",
        nome: "Sara Ferraz",
        idade: "21",
        email: "sara@qualquer.com",
        data: "30/05/2026",
        risco: "ALTO",
        score: 58
    },
    {
        id: "0003",
        nome:"Maria Luiza",
        idade: "21",
        email:"maria.luiza@qualquer.com",
        data: "30/05/2026",
        risco: "BAIXO",
        score: 15
    },
    {
        id: "0004",
        nome: "Gabriel Chara",
        idade: "21",
        email: "gabrielchara@qualquer.com",
        data: "02/06/2026",
        risco: "MÉDIO",
        score: 35
    },
];

const tbody = document.getElementById('patients-table-js');

function renderizarTabela() {
    tbody.innerHTML = '';

    pacientes.forEach(paciente => {
        
        const classeRisco = paciente.risco.toLowerCase(); 
        const linha = `
            <tr>
                <td>${paciente.id}</td>
                <td>
                    <div class="patient-info">
                        <span class="patient-name">${paciente.nome} (${paciente.idade} anos)</span>
                    </div>
                </td>
                <td>${paciente.data}</td>
                <td><span class="badge badge-${classeRisco}">${paciente.risco}</span></td>
                <td><span class="score ${classeRisco}">${paciente.score}%</span></td>
                <td><button class="btn-action"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-square-arrow-right-enter-icon lucide-square-arrow-right-enter"><path d="m10 16 4-4-4-4"/><path d="M3 12h11"/><path d="M3 8V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3"/></svg></button></td>
            </tr>
        `;
        tbody.innerHTML += linha;
    });
}
renderizarTabela();

const btnAbrir = document.getElementById('btn-abrir-aba');
const btnFechar = document.getElementById('btn-fechar-aba');
const painel = document.getElementById('painel-cadastro');
const overlay = document.getElementById('overlay');

function alternarAba() {
    painel.classList.toggle('open');
    overlay.classList.toggle('open');
}

btnAbrir.addEventListener('click', alternarAba);
btnFechar.addEventListener('click', alternarAba);
overlay.addEventListener('click', alternarAba);