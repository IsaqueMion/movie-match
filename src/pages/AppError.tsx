import { isRouteErrorResponse, useRouteError, Link } from 'react-router-dom'

export default function AppError() {
  const error = useRouteError()
  let title = 'Algo deu errado'
  let message = 'Tente recarregar ou voltar para a página inicial.'

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = 'Página não encontrada'
      message = 'O caminho acessado não existe.'
    } else {
      title = `${error.status} ${error.statusText}`
      message = (error.data as any) || message
    }
  } else if (error instanceof Error) {
    message = error.message
  }

  return (
    <main className="min-h-dvh grid place-items-center bg-neutral-900 text-white p-6">
      <div className="w-[min(92vw,28rem)] text-center">
        <h1 className="text-2xl font-semibold mb-1">{title}</h1>
        <p className="text-white/80 mb-4">{message}</p>
        <div className="flex items-center justify-center gap-2">
          <button className="px-3 py-1.5 rounded-md bg-white/10" onClick={() => window.history.back()}>
            Voltar
          </button>
          <Link to="/" className="px-3 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-600">
            Início
          </Link>
        </div>
      </div>
    </main>
  )
}
