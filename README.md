# RespirAI - Dashboard & Firmware FETIN

Sistema de monitoramento não invasivo de gases expelidos pelo pulmão, desenvolvido para auxiliar no diagnóstico e acompanhamento de doenças respiratórias.

## Funcionalidades

- **Monitoramento em tempo real** dos gases CO, C2H5OH, H2 e NH3.
- **Conexão WebSocket** direta com o ESP32.
- **Interface Responsiva & Dashboard Clinico** para apoio a médicos, enfermeiros e pacientes.

## Estrutura do Projeto

```text
RespirAI_FETIN/
├── index.html                           # Interface principal do dashboard
├── style.css                            # Estilização do dashboard
├── script.js                            # Lógica da interface e conexão WebSocket
├── firmware/
│   └── respirai_firmware/
│       └── respirai_firmware.ino        # Código-fonte do firmware ESP32 (Arduino IDE)
├── README.md                            # Documentação do repositório
└── .gitignore                           # Regras de exclusão do Git
```

## Tecnologias Utilizadas

- **Frontend:** HTML5, CSS3, JavaScript (ES6+)
- **Firmware:** C++ / Arduino Framework
- **Hardware:** ESP32

## Integrantes

- Maria Luiza
- Sara Ferraz
- Gabriel Vilhena
- Gabriel Fonseca