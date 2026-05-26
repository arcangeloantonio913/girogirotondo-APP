#!/bin/bash
# Setup EAS Build — esegui dalla cartella mobile/
# Uso: bash setup-eas.sh

G="\033[92m"; R="\033[91m"; Y="\033[93m"; B="\033[94m"; W="\033[0m"; BOLD="\033[1m"

echo -e "\n${BOLD}${B}══════════════════════════════════════${W}"
echo -e "${BOLD}${B}  SETUP EAS BUILD — Girogirotondo${W}"
echo -e "${BOLD}${B}══════════════════════════════════════${W}\n"

# 1. Installa EAS CLI
echo -e "${Y}[1/5] Installazione EAS CLI...${W}"
if command -v eas &> /dev/null; then
  echo -e "${G}✅ EAS CLI già installato: $(eas --version)${W}"
else
  sudo npm install -g eas-cli
  echo -e "${G}✅ EAS CLI installato${W}"
fi

# 2. Login Expo
echo -e "\n${Y}[2/5] Login Expo (apre browser)...${W}"
eas login

# 3. Configura progetto
echo -e "\n${Y}[3/5] Configurazione progetto EAS (aggiorna app.json con projectId)...${W}"
eas build:configure

# 4. Configura credentials
echo -e "\n${Y}[4/5] Configurazione credenziali iOS (richiede account Apple Developer)...${W}"
echo -e "${Y}   Salta con Ctrl+C se non hai ancora l'account Apple Developer${W}"
eas credentials --platform ios || echo -e "${Y}⚠️  Credenziali iOS saltate${W}"

# 5. Prima build preview
echo -e "\n${Y}[5/5] Build preview per test...${W}"
echo -e "${B}Scegli piattaforma:${W}"
echo "  a) iOS"
echo "  b) Android"  
echo "  c) Entrambe"
read -p "Scelta (a/b/c): " choice

case $choice in
  a) eas build --platform ios --profile preview ;;
  b) eas build --platform android --profile preview ;;
  c) eas build --platform all --profile preview ;;
  *) echo -e "${Y}Saltato${W}" ;;
esac

echo -e "\n${BOLD}${G}══════════════════════════════════════${W}"
echo -e "${BOLD}${G}  Setup completato!${W}"
echo -e "${BOLD}${G}══════════════════════════════════════${W}"
echo -e "\nProssimi passi:"
echo -e "  • Quando la build è pronta, scarica il link da expo.dev"
echo -e "  • iOS: carica su TestFlight tramite Apple Transporter"
echo -e "  • Android: carica su Play Console come Internal Testing"
echo -e "  • Poi: eas submit --platform ios  (o android)"
