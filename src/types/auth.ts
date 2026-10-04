import { z } from 'zod'

// ---------------------------------------------------------------------------
// Password rules — shared between signup and reset schemas.
// ---------------------------------------------------------------------------
export const passwordSchema = z
  .string()
  .min(8, 'Mínimo de 8 caracteres')
  .max(72, 'Máximo de 72 caracteres')          // bcrypt hard limit
  .regex(/[A-Z]/, 'Deve conter ao menos uma letra maiúscula')
  .regex(/[0-9]/, 'Deve conter ao menos um número')
  .regex(/[^A-Za-z0-9]/, 'Deve conter ao menos um caractere especial')

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
export const signUpSchema = z.object({
  display_name: z
    .string()
    .min(2, 'Nome deve ter ao menos 2 caracteres')
    .max(60, 'Nome muito longo'),
  email: z.string().email('Email inválido'),
  password: passwordSchema,
})

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
})

export const forgotSchema = z.object({
  email: z.string().email('Email inválido'),
})

export const resetSchema = z
  .object({
    password: passwordSchema,
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: 'As senhas não coincidem',
    path: ['confirm_password'],
  })

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------
export type SignUpValues    = z.infer<typeof signUpSchema>
export type LoginValues    = z.infer<typeof loginSchema>
export type ForgotValues   = z.infer<typeof forgotSchema>
export type ResetValues    = z.infer<typeof resetSchema>

// ---------------------------------------------------------------------------
// Auth error message localisation
// Maps Supabase English error strings → Portuguese user-facing messages.
// ---------------------------------------------------------------------------
const ERROR_MAP: Record<string, string> = {
  'Invalid login credentials':
    'Email ou senha incorretos.',
  'Email not confirmed':
    'Confirme seu email antes de entrar. Verifique sua caixa de entrada.',
  'User already registered':
    'Este email já está cadastrado. Tente fazer login.',
  'Password should be at least 6 characters':
    'Senha muito curta.',
  'Email rate limit exceeded':
    'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
  'For security purposes, you can only request this once every 60 seconds':
    'Aguarde 60 segundos antes de reenviar.',
  'Token has expired or is invalid':
    'O link expirou ou é inválido. Solicite um novo.',
}

export function mapAuthError(message: string, code?: string): string {
  if (code === 'captcha_failed') return message === 'captcha_configuration_unavailable'
    ? 'Verificacao de seguranca indisponivel.' : 'Verificacao de seguranca pendente ou expirada.'
  if (message === 'auth_request_unavailable') return 'Autenticacao indisponivel. Tente novamente.'
  return ERROR_MAP[message] ?? 'Algo deu errado. Tente novamente.'
}
