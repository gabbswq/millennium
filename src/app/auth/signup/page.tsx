'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { signUpSchema, mapAuthError, type SignUpValues } from '@/types/auth'
import { useAuth } from '@/hooks/useAuth'
import { useAuthCaptcha } from '@/hooks/useAuthCaptcha'
import { AuthCaptcha } from '@/components/auth/AuthCaptcha'
import { PasswordStrengthMeter } from '@/components/auth/PasswordStrengthMeter'

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

export default function SignUpPage() {
  const { signUp, resendVerification } = useAuth()
  const captcha = useAuthCaptcha()
  const router = useRouter()

  const [serverError, setServerError]     = useState<string | null>(null)
  const [pendingEmail, setPendingEmail]   = useState<string | null>(null)
  const [resendSent, setResendSent]       = useState(false)
  const [resending, setResending] = useState(false)
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { display_name: '', email: '', password: '' },
  })

  const password = form.watch('password')

  async function onSubmit(values: SignUpValues) {
    setServerError(null)
    const { error } = await signUp(values, captcha.takeToken())
    captcha.reset()

    if (error) {
      // Duplicate email — offer login instead of a raw error.
      if (error.message === 'User already registered') {
        setServerError(null)
        router.push(`/auth/login?hint=exists&email=${encodeURIComponent(values.email)}`)
        return
      }
      setServerError(mapAuthError(error.message, error.code))
      return
    }

    // Email confirmation required — show the resend flow.
    setPendingEmail(values.email)
  }

  async function handleResend() {
    if (!pendingEmail || resending) return
    setResending(true)
    setServerError(null)
    const { error } = await resendVerification(pendingEmail, captcha.takeToken())
    captcha.reset()
    setResending(false)
    if (error) { setServerError(mapAuthError(error.message, error.code)); return }
    setResendSent(true)
  }

  // ── Waiting for email confirmation ────────────────────────────────────────
  if (pendingEmail) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Verifique seu email</CardTitle>
            <CardDescription>
              Enviamos um link de confirmação para{' '}
              <strong>{pendingEmail}</strong>. Clique no link para ativar sua
              conta.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!resendSent && <AuthCaptcha control={captcha} />}
            {serverError && <p role="alert" className="text-sm text-destructive">{serverError}</p>}
            {resendSent ? (
              <p className="text-sm text-muted-foreground">
                Email reenviado. Verifique sua caixa de entrada (e spam).
              </p>
            ) : (
              <Button variant="outline" onClick={handleResend} disabled={!configured || !captcha.ready || resending}>
                Reenviar email de confirmação
              </Button>
            )}
            <p className="text-sm text-muted-foreground">
              Já confirmou?{' '}
              <Link href="/auth/login" className="underline">
                Fazer login
              </Link>
            </p>
          </CardContent>
        </Card>
      </main>
    )
  }

  // ── Sign-up form ──────────────────────────────────────────────────────────
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Criar conta</CardTitle>
          <CardDescription>
            Preencha os dados abaixo para começar.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {!configured && <p className="payment-notice" role="status">Autenticacao ainda nao configurada neste ambiente.</p>}
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
              noValidate
            >
              {/* Display name */}
              <FormField
                control={form.control}
                name="display_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Seu nome" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Email */}
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

              {/* Password + strength meter */}
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Senha</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Mínimo 8 caracteres"
                        autoComplete="new-password"
                        {...field}
                      />
                    </FormControl>
                    <PasswordStrengthMeter password={password} />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <AuthCaptcha control={captcha} />
              {/* Server-side error */}
              {serverError && (
                <p className="text-sm font-medium text-destructive" role="alert">
                  {serverError}
                </p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={!configured || !captcha.ready || form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? 'Criando conta…' : 'Criar conta'}
              </Button>
            </form>
          </Form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Já tem uma conta?{' '}
            <Link href="/auth/login" className="underline">
              Fazer login
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
