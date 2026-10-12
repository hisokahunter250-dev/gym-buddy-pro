# Project rules
- Define theme palettes and preview swatches in src/styles.css; UI uses semantic tokens so theme choices remain consistent.
- Set Radix direction explicitly on settings tabs to keep navigation order and keyboard behavior consistent with Arabic layout.
- Keep gym logos in private Cloud storage with admin-only uploads and authenticated reads; store object paths in app_settings and refresh signed URLs centrally so branding works across hosting origins.
- Resolve the bundled default logo's asset pointer against its Lovable origin, since the asset proxy is not available on external hosts.