# Configurar envio de emails de ativação

Os links de ativação só são enviados quando o backend consegue ligar-se a um servidor SMTP. Segue três opções para desenvolvimento/local:

## 1. Gmail (App Password)
1. Nas definições da conta Google ativa a verificação em dois passos e cria um **App Password**.
2. Atualiza `TodoApi/appsettings.Development.json` (ou usa variáveis de ambiente) com:
   ```json
   {
     "Activation": {
       "Email": {
         "Username": "teuemail@gmail.com",
         "Password": "APPPASSWORD",
         "From": "Porto <teuemail@gmail.com>"
       }
     }
   }
   ```
3. Não precisas preencher `SmtpHost`/`Port`: o código assume automaticamente `smtp.gmail.com:587` para contas Gmail.

## 2. Outlook / Hotmail / Office365
1. Cria uma password de aplicação em https://account.live.com/proofs/Manage.
2. Define:
   ```json
   {
     "Activation": {
       "Email": {
         "Username": "teuemail@outlook.com",
         "Password": "APPPASSWORD"
       }
     }
   }
   ```
   O serviço usa `smtp.office365.com:587` por omissão.

## 3. Mailpit / Mailhog (capturar emails locais)
Se só precisas visualizar os emails durante o desenvolvimento:
1. Corre `docker run --rm -p 1025:1025 -p 8025:8025 axllent/mailpit`.
2. No `appsettings.Development.json` aponta o SMTP para o Mailpit:
   ```json
   {
     "Activation": {
       "Email": {
         "SmtpHost": "localhost",
         "SmtpPort": 1025,
         "EnableSsl": false,
         "Username": "",
         "Password": ""
       }
     }
   }
   ```
3. Acede a http://localhost:8025 para ver as mensagens.

## 4. Pasta local (pickup directory)
Para testar sem nenhum servidor SMTP, ativa o modo “pickup directory”. Cada email é gravado em `.eml` dentro da pasta indicada e podes abri-lo no Outlook/Apple Mail e reenviar manualmente.

```json
{
  "Activation": {
    "Email": {
      "PickupDirectory": "storage/outbox"
    }
  }
}
```

Os ficheiros aparecem em `TodoApi/storage/outbox`.

> ⚠️ Evita commitar passwords. Usa `dotnet user-secrets`, variáveis de ambiente (`Activation__Email__Username`) ou ficheiros ignorados pelo git.
