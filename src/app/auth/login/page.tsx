'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { loginSchema, mapAuthError, type LoginValues } from '@/types/auth'
import { useAuth } from '@/hooks/useAuth'
import { useAuthCaptcha } from '@/hooks/useAuthCaptcha'
import { AuthCaptcha } from '@/components/auth/AuthCaptcha'
import { PaymentShell } from '@/components/payments/shell'

import { Button }   from '@/components/ui/button'
import { Input }    from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

// Google icon — inline SVG to avoid an extra icon dependency.
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4" aria-hidden>
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}

function LoginPageContent() {
  const { signIn, signInWithProvider } = useAuth()
  const captcha = useAuthCaptcha()
  const router = useRouter()
  const params = useSearchParams()

  const [serverError, setServerError] = useState<string | null>(null)
  const [oauthLoading, setOauthLoading] = useState(false)
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  // Pre-fill email when redirected from signup with ?hint=exists
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
    router.replace('/dashboard')
    router.refresh()
  }

  async function handleGoogleSignIn() {
    setOauthLoading(true)
    const { error } = await signInWithProvider('google')
    if (error) {
      setServerError(mapAuthError(error.message))
      setOauthLoading(false)
    }
    // On success Supabase redirects the browser; no further action needed here.
  }

  return (
    <PaymentShell><main className="payment-access">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Entrar no Millennium</CardTitle>
          <CardDescription>
            {hintExists
              ? `Este email já está cadastrado. Faça login para continuar.`
              : 'Bem-vindo de volta!'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {!configured && <p className="payment-notice" role="status">Autenticacao ainda nao configurada neste ambiente.</p>}
          {/* OAuth */}
          <Button
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignIn}
            disabled={!configured || oauthLoading || form.formState.isSubmitting}
          >
            <GoogleIcon />
            {oauthLoading ? 'Redirecionando…' : 'Continuar com Google'}
          </Button>

          <div className="relative flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">ou</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Email/password form */}
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
              noValidate
            >
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="voce@email.com"
                        autoComplete="email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Senha</FormLabel>
                      <Link
                        href="/auth/forgot"
                        className="text-xs text-muted-foreground underline"
                      >
                        Esqueceu a senha?
                      </Link>
                    </div>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="current-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <AuthCaptcha control={captcha} />
              {serverError && (
                <p className="text-sm font-medium text-destructive" role="alert">
                  {serverError}
                </p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={!configured || !captcha.ready || form.formState.isSubmitting || oauthLoading}
              >
                {form.formState.isSubmitting ? 'Entrando…' : 'Entrar'}
              </Button>
            </form>
          </Form>

          <p className="text-center text-sm text-muted-foreground">
            Não tem uma conta?{' '}
            <Link href="/auth/signup" className="underline">
              Criar conta
            </Link>
          </p>
        </CardContent>
      </Card>
    </main></PaymentShell>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  )
}
