# TikTok live — v1.6.22

O projeto era estático: `src/game.js` consultava `/votos` e `/configurar` de um servidor externo cujo código não está neste repositório. O novo backend Node serve o jogo, recebe eventos e transmite comandos por SSE. A integração antiga continua no modo padrão.

## Rodar

Use Node 20 ou superior e `npm ci`. Copie `config/gifts.example.json` para um arquivo local e substitua os valores `null` por IDs reais como strings. Os IDs precisam ser distintos. Não há nomes ou IDs presumidos: `redRose`, `whiteRose`, etc. são chaves internas de configuração.

Defina `LIVE_EVENT_TOKEN` com pelo menos 24 caracteres, `LIVE_GIFT_CONFIG` com o caminho do arquivo e `TIKTOK_USERNAME` com o @ da live. Execute `npm start` e abra `http://127.0.0.1:3000/?live=1` no navegador/OBS. O conector precisa de uma live disponível e pode exigir credenciais do provedor de assinatura conforme sua documentação. O processo encerra se a conexão inicial falhar; após desconexão, reinicie o receptor. Não há reconexão automática do TikTok nesta versão.

Presentes não mapeados são registrados com ID, nome e moedas fornecidos pelo conector para permitir confirmar a configuração. Confirme também que a rosa de `rose10` custa 10 moedas; preço sozinho nunca seleciona uma ação.

| Entrada | Ação |
| --- | --- |
| Comentário exatamente `13` | Lula atira |
| Comentário exatamente `22` | Bolsonaro atira |
| `redRose` — rosa vermelha | Lula hadouken |
| `whiteRose` — rosa branca | Bolsonaro atira |
| `miniDino` — mini dino | Lula escudo 5s |
| `rose10` — rosa 10 moedas | Bolsonaro escudo 5s |
| `doughnut` — rosquinha | Bolsonaro Bolsa Pancada |
| `capybara` — capivara | Bolsonaro Tá OK (talkey) |

Bolsa Pancada reutiliza a luva existente e atinge Lula quando executada por Bolsonaro. Não reutiliza a voz do Lula nesse caso. Escudos renovam para 5s; não acumulam duração por quantidade. Especiais respeitam animações, recargas, pausa e KO. A fila admite 500 lotes e expira após 60s; lotes excedentes são descartados. Combos executam somente o evento final, uma ação por unidade até 100; mensagens repetidas são deduplicadas por ID por 10 minutos. O stream entrega somente eventos novos, sem replay após reconexão.

## Receptor para bridge externo

Sem `TIKTOK_USERNAME`, o servidor recebe uma bridge confiável em `POST /live/events`, com `Authorization: Bearer <LIVE_EVENT_TOKEN>` e `Content-Type: application/json`. Comentário: `{"type":"chat","id":"ID_REAL_DA_MENSAGEM","comment":"13"}`. Presente: `{"type":"gift","id":"ID_REAL_DA_MENSAGEM_FINAL","giftId":"ID_REAL","giftType":1,"repeatEnd":true,"repeatCount":1}`. Preserve IDs como strings; não converta identificadores grandes para Number. Nunca use um novo ID ao reenviar o mesmo evento final.

O token fica no backend/bridge e não deve entrar na URL nem no código do navegador. Limites: 8 KiB por corpo, 100 requisições autenticadas/s, 10 consumidores SSE. Servidor ligado ao loopback por padrão. Para hospedagem pública, use HTTPS, proxy e proteção de acesso ao stream; cada navegador conectado representa uma instância independente do jogo. O backend não aceita comandos arbitrários enviados pelo cliente.

Conector: [documentação oficial do projeto](https://github.com/zerodytrash/TikTok-Live-Connector), versão npm fixada em 2.5.0. Não foi validada uma live real nesta implementação.
