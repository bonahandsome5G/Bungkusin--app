import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { CheckCircle2, BellRing, AlertCircle, X } from 'lucide-react'

type Kind = 'success' | 'info' | 'error'
interface Toast { id: number; kind: Kind; title: string; body?: string; action?: { label: string; onClick: () => void } }

const Ctx = createContext<(t: Omit<Toast, 'id'>) => void>(() => {})
let seq = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const dismiss = (id: number) => setItems((xs) => xs.filter((x) => x.id !== id))
  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = ++seq
    setItems((xs) => [...xs.slice(-2), { ...t, id }])
    setTimeout(() => dismiss(id), t.kind === 'error' ? 6000 : 5000)
  }, [])

  const Icon = { success: CheckCircle2, info: BellRing, error: AlertCircle }
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[2000] flex flex-col items-center gap-2 px-4 md:inset-x-auto md:right-4 md:top-4 md:w-[26rem] md:px-0" aria-live="polite">
        {items.map((t) => {
          const I = Icon[t.kind]
          return (
            <div key={t.id} role="status"
              className={`animate-toast pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl px-4 py-3 shadow-lg ${t.kind === 'error' ? 'bg-tomato text-white' : 'bg-forest text-cream'}`}>
              <I className={`mt-0.5 size-5 shrink-0 ${t.kind === 'error' ? '' : 'text-mustard'}`} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{t.title}</p>
                {t.body && <p className="text-sm opacity-80">{t.body}</p>}
                {t.action && (
                  <button className="mt-1 text-sm font-bold text-mustard underline underline-offset-2"
                    onClick={() => { t.action!.onClick(); dismiss(t.id) }}>{t.action.label}</button>
                )}
              </div>
              <button aria-label="Tutup" onClick={() => dismiss(t.id)} className="opacity-60 hover:opacity-100"><X className="size-4" /></button>
            </div>
          )
        })}
      </div>
    </Ctx.Provider>
  )
}

export const useToast = () => useContext(Ctx)
