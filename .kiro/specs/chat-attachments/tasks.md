# Implementation Plan: Chat Attachments

## Overview

Implementação incremental do suporte a envio e recebimento de arquivos no chat do Cockpit. Cada tarefa constrói sobre a anterior, mantendo o sistema funcional a cada passo. O fluxo segue: migração DB → storage bucket → validação → API de upload → UI do chat → outbound para canais → inbound de canais → testes.

## Tasks

- [x] 1. Database migration and shared validation constants
  - [x] 1.1 Create SQL migration `sql/migrations/014_chat_attachments.sql`
    - Add columns `arquivo_url` (TEXT), `arquivo_nome` (TEXT), `arquivo_tipo` (TEXT), `arquivo_tamanho` (BIGINT) to table `mensagens`
    - All columns nullable — existing text messages unaffected
    - Use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for idempotency
    - _Requirements: 2.1, 2.3_

  - [x] 1.2 Create validation utility for the Next.js frontend `web/utils/fileValidation.ts`
    - Export constants: `LIMITE_TAMANHO` (10 MB in bytes), `TIPOS_PERMITIDOS` (array of allowed MIME types per requirements)
    - Export functions: `validateFileSize(size: number)`, `validateFileType(mimeType: string)`, `sanitizeFileName(name: string)`, `formatFileSize(bytes: number)`
    - `sanitizeFileName` must prepend a UUID and strip special characters (keep alphanumeric, hyphens, underscores, dots)
    - `formatFileSize` returns human-readable string ("1.5 MB", "340 KB")
    - _Requirements: 3.2, 3.3, 7.1, 7.2, 7.5_

  - [x] 1.3 Create validation utility for the Node.js backend `src/fileValidation.js`
    - CommonJS module mirroring the same constants and functions as `web/utils/fileValidation.ts`
    - Export: `LIMITE_TAMANHO`, `TIPOS_PERMITIDOS`, `validateFileSize`, `validateFileType`, `sanitizeFileName`, `formatFileSize`
    - Use `const { randomUUID } = require('crypto')` for UUID generation
    - _Requirements: 7.1, 7.2, 7.5_

- [ ] 2. Checkpoint — Run migration and verify validation modules
  - Ensure the SQL migration runs without errors against the database
  - Ensure all validation functions are exported correctly and can be imported in both environments
  - Ask the user if questions arise

- [-] 3. API route for file upload and install fast-check
  - [x] 3.1 Create the upload API route `web/app/api/upload/route.ts`
    - Accept POST with `multipart/form-data` containing `file` (File) and `lead_id` (string)
    - Import and use validation functions from `web/utils/fileValidation.ts`
    - Server-side validate file size (≤ 10 MB) and MIME type (in `TIPOS_PERMITIDOS`)
    - Return 400 with `{ error: "Arquivo excede o limite de 10 MB" }` if size exceeds limit
    - Return 400 with `{ error: "Tipo de arquivo não permitido" }` if MIME type not allowed
    - Sanitize file name using `sanitizeFileName`
    - Upload to Supabase Storage bucket `chat-files` with path `{lead_id}/{uuid}_{sanitized_filename}` using the service_role key
    - Generate signed URL with 7-day validity (604800 seconds)
    - Return `{ url, nome, tipo, tamanho }` on success
    - Return 500 with appropriate error messages on storage/signing failures
    - _Requirements: 1.1, 1.2, 1.3, 3.6, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [ ] 3.2 Install `fast-check` as a dev dependency in the root project
    - Run `npm install --save-dev fast-check` in the project root
    - This is needed for property-based tests in later tasks
    - _Requirements: (testing infrastructure)_

- [x] 4. ChatCentral UI — file input, upload handler, and file message rendering
  - [x] 4.1 Update the `Mensagem` interface in `web/app/(dashboard)/tela1/components/ChatCentral.tsx`
    - Add optional fields: `arquivo_url`, `arquivo_nome`, `arquivo_tipo`, `arquivo_tamanho`
    - _Requirements: 2.2_

  - [x] 4.2 Add file upload state and handler to `ChatCentral.tsx`
    - Add state: `isUploading` (boolean), `uploadError` (string | null)
    - Add `fileInputRef` using `useRef<HTMLInputElement>(null)`
    - Wire the existing attachment button (currently placeholder "em breve") to trigger `fileInputRef.current?.click()`
    - On file selection: validate size and type client-side using `validateFileSize` and `validateFileType` from `web/utils/fileValidation.ts`
    - Show error messages: "Arquivo excede o limite de 10 MB" or "Tipo de arquivo não permitido"
    - On validation pass: POST to `/api/upload` with FormData (file + lead_id), show loading indicator
    - On upload success: emit `nova_mensagem` socket event with `tipo: 'arquivo'` and file metadata (`arquivo_url`, `arquivo_nome`, `arquivo_tipo`, `arquivo_tamanho`), set `conteudo` to the file name
    - On upload failure: show error toast and clear loading state
    - Add hidden `<input type="file" ref={fileInputRef} accept="..." onChange={handleFileSelect} />` with accept attribute matching `TIPOS_PERMITIDOS`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [x] 4.3 Add file message rendering to `ChatCentral.tsx`
    - In the message rendering loop, add a branch for `msg.tipo === 'arquivo'`
    - If `arquivo_tipo` starts with `image/`: render inline image preview with `max-width: 280px`, `max-height: 200px`, and a "Baixar" link
    - Otherwise: render a document card with a file icon (SVG), `arquivo_nome`, formatted file size (using `formatFileSize`), and a "Baixar" button
    - "Baixar" button opens `arquivo_url` in a new tab (`window.open(url, '_blank')`)
    - Apply same alignment rules as text messages (sent = right, received = left)
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 5. Checkpoint — Verify operator upload flow end-to-end
  - Ensure the attachment button opens the file selector
  - Ensure file validation errors display correctly
  - Ensure uploaded files appear as file messages in the chat
  - Ensure image previews render for image types
  - Ask the user if questions arise

- [x] 6. Server.js — outbound file delivery to Telegram and WhatsApp
  - [x] 6.1 Add `sendTelegramDocument` function to `server.js`
    - New async function: `sendTelegramDocument(chat_id, document_url, caption)`
    - Calls Telegram API `sendDocument` with `{ chat_id, document: document_url, caption }`
    - _Requirements: 4.1_

  - [x] 6.2 Extend the `nova_mensagem` socket handler in `server.js` for file outbound
    - When `tipo === 'arquivo'`: insert into `mensagens` with `arquivo_url`, `arquivo_nome`, `arquivo_tipo`, `arquivo_tamanho` fields
    - For Telegram outbound: call `sendTelegramDocument(channel_user_id, arquivo_url, arquivo_nome)`
    - For WhatsApp outbound: POST to `WEBHOOK_N8N_URL` with `{ telefone, mensagem: arquivo_nome, arquivo_url }`
    - On outbound failure: log `{ level: 'error', msg: 'outbound_file_fail', lead_id, erro }` — do not block the message save
    - _Requirements: 4.1, 4.2, 4.3_

- [ ] 7. Server.js — inbound file reception from Telegram and WhatsApp
  - [ ] 7.1 Add file download and upload helper to `server.js`
    - New async function: `downloadAndUploadFile(fileBuffer, fileName, mimeType, leadId)`
    - Uses `src/fileValidation.js` for `sanitizeFileName`
    - Uploads to Supabase Storage bucket `chat-files` with path `{leadId}/{uuid}_{sanitized_filename}`
    - Generates signed URL with 7-day validity
    - Returns `{ url, nome, tipo, tamanho }` or throws on failure
    - _Requirements: 1.1, 1.3, 7.5, 7.6_

  - [ ] 7.2 Extend the webhook handler (POST /webhook) for Telegram document reception
    - Detect `tgMsg.document` (file_id present): call Telegram `getFile` API to get `file_path`, download file from `https://api.telegram.org/file/bot{token}/{file_path}`
    - Upload to Storage via `downloadAndUploadFile`
    - Save `mensagens` record with `tipo='arquivo'`, `de=channel_user_id`, and file metadata
    - Broadcast via `io.emit('nova_mensagem_salva', data)`
    - On failure: save fallback text message `"[Arquivo recebido — falha no processamento]"` and log error
    - _Requirements: 5.1, 5.4, 5.5, 5.6_

  - [ ] 7.3 Extend the webhook handler for Telegram photo reception
    - Detect `tgMsg.photo` (array present): use last element (largest resolution) to get `file_id`
    - Same download/upload/save flow as 7.2
    - Set `arquivo_tipo` to `image/jpeg` (Telegram photos are JPEG), `arquivo_nome` to `photo_{uuid}.jpg`
    - _Requirements: 5.2, 5.4, 5.5, 5.6_

  - [ ] 7.4 Extend the webhook handler for WhatsApp file reception
    - Detect `req.body.arquivo_url` present in the payload
    - Download file from the provided URL
    - Upload to Storage via `downloadAndUploadFile`
    - Save `mensagens` record with `tipo='arquivo'` and file metadata
    - On failure: save fallback text message and log error
    - _Requirements: 5.3, 5.4, 5.5, 5.6_

- [ ] 8. Checkpoint — Verify full bidirectional file flow
  - Ensure operator-sent files reach Telegram via sendDocument
  - Ensure operator-sent files reach WhatsApp via webhook
  - Ensure Telegram documents/photos received via webhook appear in the chat
  - Ensure WhatsApp files received via webhook appear in the chat
  - Ensure fallback messages are saved when file processing fails
  - Ask the user if questions arise

- [ ] 9. Property-based tests for validation functions
  - [ ]* 9.1 Write property test for file size validation
    - **Property 1: File size validation is a correct threshold function**
    - Generate random non-negative integers (0 to 100 MB range) using fast-check
    - Assert `validateFileSize(size).valid === true` if and only if `size <= 10 * 1024 * 1024`
    - Assert error message equals "Arquivo excede o limite de 10 MB" when invalid
    - Test file: `tests/fileValidation.test.js`
    - Minimum 100 iterations
    - **Validates: Requirements 3.2, 7.1, 3.4, 7.3**

  - [ ]* 9.2 Write property test for file type validation
    - **Property 2: File type validation accepts exactly the allowed MIME types**
    - Generate random strings (mix of valid MIME types from `TIPOS_PERMITIDOS` and arbitrary strings) using fast-check
    - Assert `validateFileType(mimeType).valid === true` if and only if `mimeType` is in `TIPOS_PERMITIDOS`
    - Assert error message equals "Tipo de arquivo não permitido" when invalid
    - Test file: `tests/fileValidation.test.js`
    - Minimum 100 iterations
    - **Validates: Requirements 3.3, 7.2, 3.5, 7.4**

  - [ ]* 9.3 Write property test for file name sanitization
    - **Property 3: File name sanitization produces safe names with UUID prefix**
    - Generate random strings (including unicode, special characters, spaces, empty strings) using fast-check
    - Assert result starts with a valid UUID pattern followed by underscore
    - Assert characters after UUID prefix are only alphanumeric, hyphens, underscores, and dots
    - Assert original file extension is preserved if one exists
    - Test file: `tests/fileValidation.test.js`
    - Minimum 100 iterations
    - **Validates: Requirements 7.5**

  - [ ]* 9.4 Write property test for file message record construction
    - **Property 4: File message record construction preserves all metadata**
    - Generate random file metadata (url, name, MIME type, size, sender) using fast-check
    - Assert constructed record has `tipo === 'arquivo'`, and all `arquivo_*` fields match inputs
    - Test file: `tests/fileValidation.test.js`
    - Minimum 100 iterations
    - **Validates: Requirements 2.2, 5.4**

- [ ] 10. Unit and integration tests
  - [ ]* 10.1 Write unit tests for validation edge cases
    - Test `validateFileSize` with boundary values: 0, exactly 10 MB, 10 MB + 1 byte, very large values
    - Test `validateFileType` with each type in `TIPOS_PERMITIDOS` and invalid types (e.g., `text/plain`, `application/zip`, empty string)
    - Test `sanitizeFileName` with normal names, names with special characters, unicode, spaces, multiple dots, no extension
    - Test `formatFileSize` with 0, 500, 1024, 1536000, 10485760
    - Test file: `tests/fileValidation.test.js`
    - _Requirements: 3.2, 3.3, 7.1, 7.2, 7.5_

  - [ ]* 10.2 Write integration tests for the upload API route
    - Mock Supabase Storage upload and createSignedUrl
    - Test successful upload returns `{ url, nome, tipo, tamanho }` with status 200
    - Test file too large returns 400 with correct error message
    - Test invalid MIME type returns 400 with correct error message
    - Test Storage upload failure returns 500
    - Test file: `tests/uploadRoute.test.js`
    - _Requirements: 1.1, 1.2, 1.3, 7.1, 7.2, 7.3, 7.4, 7.6_

  - [ ]* 10.3 Write integration tests for outbound file delivery
    - Mock Telegram API and n8n webhook
    - Test that `nova_mensagem` with `tipo='arquivo'` calls `sendDocument` for Telegram leads
    - Test that `nova_mensagem` with `tipo='arquivo'` calls n8n webhook for WhatsApp leads
    - Test that outbound failure is logged but does not prevent message save
    - Test file: `tests/fileOutbound.test.js`
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ]* 10.4 Write integration tests for inbound file reception
    - Mock Telegram getFile API, file download, and Supabase Storage
    - Test Telegram document webhook: file downloaded, uploaded to Storage, mensagem saved with tipo='arquivo'
    - Test Telegram photo webhook: largest photo selected, downloaded, uploaded, mensagem saved
    - Test WhatsApp arquivo_url webhook: file downloaded, uploaded, mensagem saved
    - Test failure fallback: when download fails, fallback text message "[Arquivo recebido — falha no processamento]" is saved
    - Test file: `tests/fileInbound.test.js`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [ ] 11. Final checkpoint — Ensure all tests pass
  - Run `npm test` and verify all test suites pass
  - Ensure all validation, upload, outbound, and inbound tests are green
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key integration points
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The backend uses CommonJS (`require`/`module.exports`) — all `.js` files in `src/` and `tests/`
- The frontend uses TypeScript/ESM — all `.ts`/`.tsx` files in `web/`
- fast-check needs to be installed as a dev dependency before property tests can run
