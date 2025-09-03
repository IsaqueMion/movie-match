import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../supabase'
import { Toaster, toast } from 'sonner'

export default function JoinSession() {
  const navigate = useNavigate()
  const location = useLocation()

  const [code, setCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Lê ?code= da URL e preenche automaticamente
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const urlCode = (params.get('code') || params.get('c') || '').toUpperCase()
    if (urlCode) setCode(urlCode)

    // Se quiser que ao abrir o link já entre na sessão, use ?autojoin=1
    const auto = params.get('autojoin')
    if (urlCode && auto === '1') {
      // pequena espera para o input renderizar
      setTimeout(() => joinWithCode(urlCode), 50)
    }
  }, [location.search])

  async function joinWithCode(codeArg?: string) {
    if (joining) return
    setJoining(true)
    setErrorMsg(null)

    try {
      const clean = (codeArg ?? code).trim().toUpperCase()
      if (clean.length < 3) throw new Error('Informe um código válido.')

      // garante usuário autenticado (anônimo conta)
      let { data: userData } = await supabase.auth.getUser()
      if (!userData?.user) {
        const { data: auth, error: authErr } = await supabase.auth.signInAnonymously()
        if (authErr) throw authErr
        userData = { user: auth.user! }
      }
      const uid = userData!.user!.id

      // upsert do usuário
      const { error: upUserErr } = await supabase
        .from('users')
        .upsert({ id: uid, display_name: 'Guest' }, { onConflict: 'id' })
      if (upUserErr) throw upUserErr

      // busca sessão pelo código
      const { data: sess, error: sessErr } = await supabase
        .from('sessions')
        .select('id, code')
        .eq('code', clean)
        .single()
      if (sessErr || !sess) throw new Error('Sessão não encontrada.')

      // adiciona/garante membro
      const { error: memErr } = await supabase
        .from('session_members')
        .upsert({ session_id: sess.id, user_id: uid }, { onConflict: 'session_id,user_id' })
      if (memErr) throw memErr

      toast.success(`Você entrou na sessão ${sess.code}`)
      navigate(`/s/${sess.code}`)
    } catch (e: any) {
      console.error('join-session error', e)
      const msg = e?.message ?? e?.error_description ?? 'Falha ao entrar na sessão'
      setErrorMsg(msg)
      toast.error(msg)
    } finally {
      setJoining(false)
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    joinWithCode()
  }

  return (
    <main className="min-h-dvh flex items-center justify-center bg-gradient-to-b from-neutral-900 via-neutral-900 to-neutral-800 text-white p-6">
      <div className="w-[min(92vw,28rem)]">
        <h1 className="text-xl font-semibold mb-2">Entrar em sessão</h1>
        <p className="text-white/80 mb-4">Digite o código que seu amigo compartilhou.</p>

        <form onSubmit={handleJoin} className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Ex.: 3YR6F"
            className="flex-1 px-3 py-2 rounded-md bg-white/10 ring-1 ring-white/15 placeholder-white/40 outline-none"
            autoFocus
          />
          <button
            type="submit"
            disabled={joining}
            className="px-4 py-2 rounded-md bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60"
          >
            {joining ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        {errorMsg && <p className="mt-3 text-sm text-red-300">{errorMsg}</p>}
      </div>

      <Toaster richColors position="top-center" />
    </main>
  )
}
