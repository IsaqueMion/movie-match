// Tipos mínimos para o runtime das Edge Functions (Deno) — só p/ editor
declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
  env: { get(name: string): string | undefined }
}
