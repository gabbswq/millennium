'use client'

import Image from 'next/image'
import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { loginSchema, mapAuthError, type LoginValues } from '@/types/auth'
import { safeAuthNextPath } from '@/lib/auth/redirect'
import { useAuth } from '@/hooks/useAuth'
import { useAuthCaptcha } from '@/hooks/useAuthCaptcha'
import { AuthCaptcha } from '@/components/auth/AuthCaptcha'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.05 5.05 0 0 1-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.09a6.96 6.96 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z" />
    </svg>
  )
}

function readableOAuthError(message: string) {
  if (/provider.*not enabled|unsupported provider/i.test(message)) {
    return 'O acesso com Google ainda não foi ativado nas configurações do Millennium.'
  }
  if (/unable to verify oauth provider configuration/i.test(message)) {
    return 'Não foi possível verificar a configuração do Google agora. Confira sua conexão e tente novamente.'
  }
  if (/redirect.*(allow|url)|invalid redirect/i.test(message)) {
    return 'O endereço de retorno do login ainda não está autorizado no Supabase.'
  }
  return mapAuthError(message)
}

function LoginPageContent() {
  const { signIn, signInWithProvider } = useAuth()
  const captcha = useAuthCaptcha()
  const router = useRouter()
  const params = useSearchParams()

  const [serverError, setServerError] = useState<string | null>(null)
  const [oauthLoading, setOauthLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  const hintEmail = params.get('email') ?? ''
  const hintExists = params.get('hint') === 'exists'

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: hintEmail, password: '' },
  })

  async function onSubmit(values: LoginValues) {
    setServerError(null)
    const { error } = await signIn(values, captcha.takeToken())
    captcha.reset()
    if (error) {
      setServerError(mapAuthError(error.message, error.code))
      return
    }
    router.replace(safeAuthNextPath(params.get('next')))
    router.refresh()
  }

  async function handleGoogleSignIn() {
    setServerError(null)
    setOauthLoading(true)
    const { error } = await signInWithProvider('google', safeAuthNextPath(params.get('next')))
    if (error) {
      setServerError(readableOAuthError(error.message))
      setOauthLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <header className="auth-header">
        <Link href="/" className="auth-brand" aria-label="Millennium, início">
          <Image src="/millennium-mark.svg" width={30} height={30} alt="" priority />
          <span>Millennium</span>
        </Link>
        <Link href="/" className="auth-home-link">Voltar ao início</Link>
      </header>

      <div className="auth-layout">
        <section className="auth-story" aria-labelledby="auth-story-title">
          <div className="auth-story-copy">
            <span className="auth-overline"><span aria-hidden="true" /> ESPAÇO DO MILLENNIUM</span>
            <h1 id="auth-story-title">Seu próximo passo começa com clareza.</h1>
            <p>Entre na sua conta para continuar de onde parou.</p>
          </div>
          <div className="auth-visual" aria-hidden="true">
            <div className="auth-visual-top"><span>CONTA MILLENNIUM</span><span>01 / 03</span></div>
            <div className="auth-orbit auth-orbit-one"><i /><i /><i /></div>
            <div className="auth-orbit auth-orbit-two"><i /><i /></div>
            <div className="auth-visual-line" />
            <div className="auth-visual-bottom"><span>Uma etapa de cada vez.</span><span className="auth-visual-mark">M</span></div>
          </div>
          <p className="auth-story-foot">Uma ideia em construção, com espaço para crescer.</p>
        </section>

        <section className="auth-panel" aria-labelledby="auth-title">
          <div className="auth-form-wrap">
            <p className="auth-kicker">ACESSO À CONTA</p>
            <h2 id="auth-title">Entrar no Millennium</h2>
            <p className="auth-subtitle">
              {hintExists ? 'Este email já tem uma conta. Entre para continuar.' : 'Que bom ter você de volta.'}
            </p>

            {!configured && (
              <div className="auth-notice" role="status">
                O acesso ainda não está conectado neste ambiente. Configure o Supabase para habilitar o login.
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              className="auth-google-button"
              onClick={handleGoogleSignIn}
              disabled={!configured || oauthLoading || form.formState.isSubmitting}
            >
              <GoogleIcon />
              <span>{oauthLoading ? 'Conectando ao Google…' : 'Continuar com Google'}</span>
            </Button>

            <div className="auth-divider"><span>ou entre com seu email</span></div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="auth-fields" noValidate>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="auth-field">
                      <FormLabel className="auth-label">Email</FormLabel>
                      <FormControl>
                        <Input className="auth-input" type="email" placeholder="voce@email.com" autoComplete="email" autoCapitalize="none" {...field} />
                      </FormControl>
                      <FormMessage className="auth-field-error" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem className="auth-field">
                      <div className="auth-label-row">
                        <FormLabel className="auth-label">Senha</FormLabel>
                        <Link href="/auth/forgot" className="auth-forgot">Esqueceu a senha?</Link>
                      </div>
                      <div className="auth-password-wrap">
                        <FormControl>
                          <Input className="auth-input auth-password-input" type={showPassword ? 'text' : 'password'} placeholder="Sua senha" autoComplete="current-password" {...field} />
                        </FormControl>
                        <button
                          type="button"
                          className="auth-password-toggle"
                          aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                          aria-pressed={showPassword}
                          onClick={() => setShowPassword(value => !value)}
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                      <FormMessage className="auth-field-error" />
                    </FormItem>
                  )}
                />

                <AuthCaptcha control={captcha} />
                {serverError && <p className="auth-error" role="alert">{serverError}</p>}

                <Button
                  type="submit"
                  className="auth-submit"
                  disabled={!configured || !captcha.ready || form.formState.isSubmitting || oauthLoading}
                >
                  <span>{form.formState.isSubmitting ? 'Entrando…' : 'Entrar'}</span>
                  {!form.formState.isSubmitting && <ArrowRight size={17} aria-hidden="true" />}
                </Button>
              </form>
            </Form>

            <p className="auth-signup">
              Ainda não tem uma conta? <Link href="/auth/signup">Criar conta</Link>
            </p>
            <p className="auth-security"><ShieldCheck size={15} aria-hidden="true" /> Suas credenciais são tratadas pelo Supabase Auth.</p>
          </div>
        </section>
      </div>
      <footer className="auth-footer"><span>© 2026 Millennium</span><span>Uma plataforma em construção.</span></footer>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="auth-page auth-loading" aria-label="Carregando acesso"><span /></main>}>
      <LoginPageContent />
    </Suspense>
  )
}
