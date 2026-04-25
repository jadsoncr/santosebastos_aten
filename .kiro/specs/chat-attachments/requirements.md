# Requirements Document

## Introduction

Funcionalidade de anexo de arquivos no chat do Cockpit (BRO Resolve). Permite que operadores e clientes enviem, visualizem e baixem arquivos (PDF, imagens, documentos) durante o atendimento. Os arquivos são armazenados no Supabase Storage e integrados ao fluxo existente de mensagens via Telegram e WhatsApp. Esta é uma funcionalidade crítica para vendas — advogados precisam enviar propostas/documentos e clientes precisam enviar arquivos, tudo com persistência garantida.

## Glossary

- **Sistema_Chat**: O componente de chat central do Cockpit (ChatCentral.tsx) onde operadores interagem com leads
- **Servidor**: O servidor Node.js + Express + Socket.io (server.js) que processa webhooks, gerencia sockets e faz outbound para canais
- **Storage**: O Supabase Storage, serviço de armazenamento de objetos usado para persistir arquivos enviados
- **Bucket_Chat_Files**: O bucket `chat-files` no Supabase Storage dedicado a arquivos do chat
- **Operador**: Usuário autenticado do Cockpit que atende leads (advogado ou atendente)
- **Cliente**: Pessoa que envia mensagens via Telegram ou WhatsApp e é atendida pelo sistema
- **Mensagem_Arquivo**: Registro na tabela `mensagens` com tipo='arquivo' contendo metadados do arquivo (URL, nome, tipo MIME, tamanho)
- **Canal**: Meio de comunicação do cliente — Telegram (API direta) ou WhatsApp (via webhook n8n)
- **Tipos_Permitidos**: Conjunto de tipos MIME aceitos para upload — PDF (application/pdf), imagens (image/jpeg, image/png, image/gif, image/webp), documentos (application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)
- **Limite_Tamanho**: Tamanho máximo permitido por arquivo: 10 MB

## Requirements

### Requirement 1: Configuração do Storage

**User Story:** Como operador, eu quero que exista um bucket dedicado para arquivos do chat, para que todos os anexos sejam armazenados de forma organizada e acessível.

#### Acceptance Criteria

1. THE Bucket_Chat_Files SHALL exist in Supabase Storage with the name `chat-files`
2. THE Bucket_Chat_Files SHALL allow authenticated uploads via the Supabase service_role key on the Servidor
3. THE Bucket_Chat_Files SHALL generate signed URLs with a validity period of 7 days for file access

### Requirement 2: Schema do Banco de Dados para Arquivos

**User Story:** Como operador, eu quero que mensagens de arquivo tenham metadados completos no banco, para que o sistema possa renderizar e gerenciar os anexos corretamente.

#### Acceptance Criteria

1. THE tabela `mensagens` SHALL contain the columns `arquivo_url` (TEXT), `arquivo_nome` (TEXT), `arquivo_tipo` (TEXT), and `arquivo_tamanho` (BIGINT)
2. WHEN a Mensagem_Arquivo is saved, THE Servidor SHALL populate `tipo` as 'arquivo', `arquivo_url` with the signed URL, `arquivo_nome` with the original file name, `arquivo_tipo` with the MIME type, and `arquivo_tamanho` with the file size in bytes
3. THE tabela `mensagens` SHALL allow `arquivo_url`, `arquivo_nome`, `arquivo_tipo`, and `arquivo_tamanho` to be NULL for non-file messages

### Requirement 3: Upload de Arquivo pelo Operador

**User Story:** Como operador, eu quero anexar arquivos no chat, para que eu possa enviar propostas, contratos e documentos ao cliente durante o atendimento.

#### Acceptance Criteria

1. THE Sistema_Chat SHALL display an attachment button in the input area that opens the native file selector on click
2. WHEN the Operador selects a file, THE Sistema_Chat SHALL validate that the file size is at most equal to Limite_Tamanho (10 MB)
3. WHEN the Operador selects a file, THE Sistema_Chat SHALL validate that the file MIME type is included in Tipos_Permitidos
4. IF the file exceeds Limite_Tamanho, THEN THE Sistema_Chat SHALL display the error message "Arquivo excede o limite de 10 MB"
5. IF the file type is not in Tipos_Permitidos, THEN THE Sistema_Chat SHALL display the error message "Tipo de arquivo não permitido"
6. WHEN validation passes, THE Sistema_Chat SHALL upload the file to Bucket_Chat_Files via the Servidor and display a loading indicator during the upload
7. WHEN the upload completes, THE Servidor SHALL save a Mensagem_Arquivo in the database and broadcast the message via Socket.io to all connected clients
8. WHEN the upload completes, THE Sistema_Chat SHALL emit the file message through the existing `nova_mensagem` socket event with tipo='arquivo' and the file metadata

### Requirement 4: Envio de Arquivo para o Cliente via Canal

**User Story:** Como operador, eu quero que o arquivo enviado no chat chegue ao cliente no Telegram ou WhatsApp, para que o cliente receba o documento no canal onde está conversando.

#### Acceptance Criteria

1. WHEN a Mensagem_Arquivo is sent by the Operador and the Canal is Telegram, THE Servidor SHALL send the file using the Telegram `sendDocument` API with the signed URL and the original file name as caption
2. WHEN a Mensagem_Arquivo is sent by the Operador and the Canal is WhatsApp, THE Servidor SHALL send the file URL via the n8n webhook with the payload containing `telefone`, `mensagem` (file URL), and `arquivo_url`
3. IF the outbound file delivery fails, THEN THE Servidor SHALL log the error with level 'error' and the message 'outbound_file_fail' including lead_id and the error details

### Requirement 5: Recebimento de Arquivo do Cliente

**User Story:** Como operador, eu quero ver no Cockpit os arquivos que o cliente envia pelo Telegram ou WhatsApp, para que eu possa analisar documentos enviados pelo cliente sem sair do sistema.

#### Acceptance Criteria

1. WHEN the Servidor receives a Telegram webhook containing a document (file_id present in message.document), THE Servidor SHALL download the file using the Telegram `getFile` API and upload the file to Bucket_Chat_Files
2. WHEN the Servidor receives a Telegram webhook containing a photo (photo array present in message), THE Servidor SHALL download the largest photo size using the Telegram `getFile` API and upload the file to Bucket_Chat_Files
3. WHEN the Servidor receives a WhatsApp webhook containing a file (arquivo_url field present in the payload), THE Servidor SHALL download the file from the provided URL and upload the file to Bucket_Chat_Files
4. WHEN a client file is uploaded to Storage, THE Servidor SHALL save a Mensagem_Arquivo in the database with `de` set to the channel_user_id, `tipo` set to 'arquivo', and the file metadata populated
5. WHEN a client file message is saved, THE Servidor SHALL broadcast the Mensagem_Arquivo via Socket.io using the `nova_mensagem_salva` event
6. IF the client file download or upload fails, THEN THE Servidor SHALL save a text message with conteudo "[Arquivo recebido — falha no processamento]" and log the error

### Requirement 6: Exibição de Arquivo no Chat

**User Story:** Como operador, eu quero visualizar mensagens de arquivo de forma clara no chat, para que eu possa identificar rapidamente documentos enviados e recebidos.

#### Acceptance Criteria

1. WHEN a Mensagem_Arquivo is rendered in the Sistema_Chat, THE Sistema_Chat SHALL display a document icon, the file name (arquivo_nome), the file size formatted in KB or MB, and a "Baixar" button
2. WHEN a Mensagem_Arquivo has arquivo_tipo starting with 'image/', THE Sistema_Chat SHALL display an inline image preview with a maximum width of 280 pixels and a maximum height of 200 pixels
3. WHEN the Operador clicks the "Baixar" button, THE Sistema_Chat SHALL open the arquivo_url in a new browser tab
4. THE Sistema_Chat SHALL apply the same alignment rules to Mensagem_Arquivo as to text messages — sent messages aligned right, received messages aligned left

### Requirement 7: Validação e Segurança no Servidor

**User Story:** Como administrador do sistema, eu quero que o servidor valide arquivos antes de armazená-los, para que o storage não seja usado para conteúdo inválido ou excessivamente grande.

#### Acceptance Criteria

1. WHEN the Servidor receives a file upload request, THE Servidor SHALL validate that the file size is at most equal to Limite_Tamanho (10 MB) before uploading to Storage
2. WHEN the Servidor receives a file upload request, THE Servidor SHALL validate that the file MIME type is included in Tipos_Permitidos before uploading to Storage
3. IF the server-side validation fails for size, THEN THE Servidor SHALL return an error response with status 400 and the message "Arquivo excede o limite de 10 MB"
4. IF the server-side validation fails for type, THEN THE Servidor SHALL return an error response with status 400 and the message "Tipo de arquivo não permitido"
5. THE Servidor SHALL sanitize the file name by removing special characters (keeping only alphanumeric, hyphens, underscores, and dots) and prepending a UUID to prevent name collisions in Storage
6. THE Servidor SHALL generate signed URLs with a validity of 7 days for all file access operations
