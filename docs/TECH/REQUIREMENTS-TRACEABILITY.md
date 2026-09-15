# Trazabilidad de requisitos

| ID | Requisito | Frontend | Backend | Contrato | Pruebas |
|---|---|---|---|---|---|
| AUTH-01 | Login email + TOTP | Auth UI | Auth module | Auth schemas | E2E |
| AUTH-02 | Trusted 30 días | Session UI | Auth/session | Auth schemas | Integration |
| ALB-01 | Crear álbum | Album editor | Albums | Album schemas | E2E |
| ALB-02 | Público/privado | Settings | Authorization | Album schemas | E2E |
| R2-01 | Conectar R2 | Wizard | Storage | Storage schemas | Integration |
| R2-02 | Upload foto | Uploader | Assets/R2 | Asset schemas | E2E |
| MOD-01 | Moderación | Queue | Moderation | Moderation schemas | E2E |
| AI-01 | Tema IA | Theme builder | Themes | Theme schemas | Integration |
| YT-01 | YouTube OAuth | Connect UI | YouTube | Integration schemas | Integration |
| LIVE-01 | Live | Live UI | Live + gateway | Live schemas | E2E |
