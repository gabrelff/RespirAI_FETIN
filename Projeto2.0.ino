#include <WiFi.h>
#include <LittleFS.h>
#include <WebServer.h>
#include <WebSocketsServer.h>
#include "DFRobot_MICS.h"

// --- Bibliotecas do Display OLED ---
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// Config do Wi-Fi e Servidores WebSocket
const char* ssidAP = "Meu_ESP_AP";
const char* passwordAP = "12345678";
WebServer server(80);                              
WebSocketsServer webSocket = WebSocketsServer(81); 

// Configurações do Sensor MiCS
#define CALIBRATION_TIME 2 
#define ADC_PIN 34
#define POWER_PIN 33 
DFRobot_MICS_ADC mics(ADC_PIN, POWER_PIN);

// --- Configurações do Display OLED ---
#define SCREEN_WIDTH 128 
#define SCREEN_HEIGHT 64 
#define OLED_RESET -1    
#define SCREEN_ADDRESS 0x3C 
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// --- NOVO: Configurações do Gatilho e Máquina de Estados ---
#define BOTAO_PIN 18 // Conecte um botão entre o pino 18 e o GND
bool capturando = false;
unsigned long tempoInicioCaptura = 0;
const unsigned long tempoJanela = 5000; // 5 segundos de sopro
unsigned long tempoAnterior = 0;
const long intervaloLeitura = 200; // Lê a cada 200ms durante o sopro para não perder o pico

// Variáveis para guardar os Picos Máximos (Max)
float max_co = 0, max_ch4 = 0, max_c2h5oh = 0, max_h2 = 0, max_nh3 = 0, max_no2 = 0;

// Função para zerar variáveis e iniciar a captura
void iniciarTeste() {
  capturando = true;
  tempoInicioCaptura = millis();
  
  // Zera os picos da leitura anterior
  max_co = 0; 
  max_ch4 = 0; 
  max_c2h5oh = 0; 
  max_h2 = 0; 
  max_nh3 = 0; 
  max_no2 = 0;
  
  // Aviso visual imediato
  display.clearDisplay();
  display.setTextSize(2);
  display.setCursor(0, 20);
  display.println("SOPRE");
  display.println("AGORA!");
  display.display();
  Serial.println("Gatilho acionado. Captura de 5 segundos iniciada!");
}

// Evento do WebSocket (Gatilho Web)
void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
  if(type == WStype_TEXT) {
    String msg = (char*)payload;
    // Se receber "START" do Javascript, e não estiver testando, inicia
    if(msg == "START" && !capturando) {
      iniciarTeste();
    }
  }
}

void setup() {
  Serial.begin(115200);

  // Configura o Pino do Botão Físico
  pinMode(BOTAO_PIN, INPUT_PULLUP);

  // Inicializa o Display OLED
  if(!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    Serial.println(F("Falha ao iniciar o OLED SSD1306"));
    for(;;);
  }
  
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(15, 10);
  display.println("--- RespirAI ---");
  display.setCursor(0, 30);
  display.println("Aquecendo Sensor...");
  display.display(); 

  // Inicia LittleFS, Wi-Fi e Servidores
  if (!LittleFS.begin(true)) return;
  WiFi.softAP(ssidAP, passwordAP);
  server.serveStatic("/", LittleFS, "/");
  server.begin();
  webSocket.begin();
  webSocket.onEvent(webSocketEvent);

  // Inicializa o Sensor
  while (!mics.begin()) {
    delay(1000);
  }
  
  // Acorda o sensor uma única vez
  if (mics.getPowerState() == SLEEP_MODE) {
    mics.wakeUpMode();
  }

  while (!mics.warmUpTime(CALIBRATION_TIME)) {
    delay(1000);
  }
  
  // Tela de Prontidão Inicial
  telaAguardando();
}

void loop() {
  server.handleClient();
  webSocket.loop();

  unsigned long tempoAtual = millis();

  // --- Gatilho Físico (Botão no aparelho) ---
  if (digitalRead(BOTAO_PIN) == LOW && !capturando) {
    iniciarTeste();
    delay(200); // Debounce simples para o botão
  }

  // --- Processo de Captura ---
  if (capturando) {
    // Faz a leitura rápida (a cada 200ms) para não sobrecarregar o I2C/ADC
    if (tempoAtual - tempoAnterior >= intervaloLeitura) {
      tempoAnterior = tempoAtual;

      // Atualiza os valores Máximos (Pico)
      float co = mics.getGasData(CO);
      if (co > max_co) max_co = co;
      
      float ch4 = mics.getGasData(CH4);
      if (ch4 > max_ch4) max_ch4 = ch4;
      
      float c2h5oh = mics.getGasData(C2H5OH);
      if (c2h5oh > max_c2h5oh) max_c2h5oh = c2h5oh;
      
      float h2 = mics.getGasData(H2);
      if (h2 > max_h2) max_h2 = h2;
      
      float nh3 = mics.getGasData(NH3);
      if (nh3 > max_nh3) max_nh3 = nh3;
      
      float no2 = mics.getGasData(NO2);
      if (no2 > max_no2) max_no2 = no2;

      // Verifica se o tempo de 5 segundos esgotou
      if (tempoAtual - tempoInicioCaptura >= tempoJanela) {
        capturando = false; // Encerra o sopro
        processarResultado(); // Calcula diagnóstico e mostra
      }
    }
  }
}

// Função para desenhar a tela de ócio
void telaAguardando() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(15, 10);
  display.println("--- RespirAI ---");
  display.setCursor(0, 35);
  display.println("Aguardando Gatilho...");
  display.display();
}

// Função que processa os picos após os 5 segundos
void processarResultado() {
  // Camada de Inferência Diagnóstica (Usando os picos máximos)
  String alertaRenal = "Normal";
  String alertaDiabetes = "Normal";
  String alertaGastro = "Normal";
  String alertaOncologico = "Normal";
  String alertaOLED = "Normal (0 Risco)"; 

  if (max_nh3 > 1.8) {
    alertaRenal = "Risco Renal (>1.8ppm)";
    alertaOLED = "Risco Renal (NH3)";
  } else if (max_c2h5oh > 1.7) {
    alertaDiabetes = "Risco Cetoacidose";
    alertaOLED = "Risco Diabete (VOC)";
  } else if (max_h2 > 7.0) {
    alertaGastro = "Alt. Microbioma";
    alertaOLED = "Alt. Gastro (H2)";
  } else if (max_co > 0 && max_co < 0.09) { 
    alertaOncologico = "Risco Suspeito (Queda VOC)";
    alertaOLED = "Risco Oncologico";
  }

  // Monta o JSON
  String json = "{";
  json += "\"DadosBrutos\": {";
  json += "\"CO\":" + String(max_co, 2) + ",";
  json += "\"CH4\":" + String(max_ch4, 2) + ",";
  json += "\"VOC_Proxy\":" + String(max_c2h5oh, 2) + ",";
  json += "\"H2\":" + String(max_h2, 2) + ",";
  json += "\"NH3\":" + String(max_nh3, 2) + ",";
  json += "\"NO2\":" + String(max_no2, 2);
  json += "},";
  json += "\"DiagnosticoIA\": {";
  json += "\"Status_NH3\":\"" + alertaRenal + "\",";
  json += "\"Status_Acetona\":\"" + alertaDiabetes + "\",";
  json += "\"Status_H2\":\"" + alertaGastro + "\",";
  json += "\"Status_Isopreno\":\"" + alertaOncologico + "\"";
  json += "}";
  json += "}";

  // Dispara os dados consolidados para o Web Dashboard
  webSocket.broadcastTXT(json);

  // Atualiza o OLED com o Resultado Final Travado
  display.clearDisplay(); 
  display.setTextSize(1);
  display.setCursor(15, 0);
  display.println("--- RESULTADO ---");

  display.setCursor(0, 15);
  display.print("VOC: "); display.print(max_c2h5oh, 1);
  display.setCursor(64, 15);
  display.print("CO : "); display.print(max_co, 1);

  display.setCursor(0, 30);
  display.print("NH3: "); display.print(max_nh3, 1);
  display.setCursor(64, 30);
  display.print("H2 : "); display.print(max_h2, 1);

  display.setCursor(0, 45);
  display.print("Status Clinico:");
  display.setCursor(0, 55);
  display.print(alertaOLED); 

  display.display(); 
}