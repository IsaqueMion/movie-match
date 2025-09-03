import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { toast, Toaster } from 'sonner'

function randomCode(len = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sem O/0/I/1
  let out = ''
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

export default function CreateSession() {
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleCreate() {
    if (creating) return
    setCreating(true)
    setErrorMsg(null)
    try {
      // 1) garante usuário (anônimo => role 'authenticated')
      let { data: userData } = await supabase.auth.getUser()
      if (!userData?.user) {
        const { data: auth, error: authErr } = await supabase.auth.signInAnonymously()
        if (authErr) throw authErr
        userData = { user: auth.user! }
      }
      const uid = userData!.user!.id

      // 2) upsert usuário
      const { error: upUserErr } = await supabase
        .from('users')
        .upsert({ id: uid, display_name: 'Guest' }, { onConflict: 'id' })
      if (upUserErr) throw upUserErr

      // 3) cria sessão (tenta evitar colisão de código)
      let sess: { id: string; code: string } | null = null
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = randomCode(6)
        const { data, error } = await supabase
          .from('sessions')
          .insert({ code })
          .select('id, code')
          .single()

        if (!error && data) { sess = data; break }
        // 23505 = unique_violation (código já existe) => tenta outro
        if (error && (error as any).code !== '23505') throw error
      }
      if (!sess) throw new Error('Não foi possível gerar um código único para a sessão.')

      // 4) adiciona criador como membro
      const { error: memErr } = await supabase
        .from('session_members')
        .upsert({ session_id: sess.id, user_id: uid }, { onConflict: 'session_id,user_id' })
      if (memErr) throw memErr

      toast.success(`Sessão criada: ${sess.code}`)
      navigate(`/s/${sess.code}`)
    } catch (e: any) {
      console.error('create-session error', e)
      const msg = e?.message ?? e?.error_description ?? 'Falha ao criar a sessão'
      setErrorMsg(msg)
      toast.error(msg)
    } finally {
      setCreating(false)
    }
  }

  return (
    <main className="min-h-dvh flex items-center justify-center bg-gradient-to-b from-neutral-900 via-neutral-900 to-neutral-800 text-white p-6">
      <div className="w-[min(92vw,28rem)]">
        <h1 className="text-xl font-semibold mb-2">Criar sessão</h1>
        <p className="text-white/80 mb-4">Gere um código e convide seus amigos para dar like nos filmes.</p>

        <button
          onClick={handleCreate}
          disabled={creating}
          className="px-4 py-2 rounded-md bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60"
        >
          {creating ? 'Criando…' : 'Criar sessão'}
        </button>

        {errorMsg && (
          <p className="mt-3 text-sm text-red-300">
            {errorMsg}
          </p>
        )}
      </div>

      <Toaster richColors position="top-center" />
    </main>
  )
}
