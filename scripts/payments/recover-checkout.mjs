import { runRecoveryCommand } from './recovery.ts'
import { CheckoutRecoveryError } from '../../src/lib/stripe/recovery.ts'

if (process.argv.slice(2).join(' ') === '--help') {
  console.log('Usage: npm run payments:recover-checkout -- --checkout <uuid> --session <cs_test_id> [--bind-open]')
  console.log('Default: inspect only. --bind-open links an existing open test session; never creates or marks payments paid.')
} else {
  try {
    const result = await runRecoveryCommand(process.argv.slice(2))
    console.log(JSON.stringify(result))
    if (result.outcome === 'TERMINAL_SESSION_REQUIRES_REVIEW') process.exitCode = 2
  } catch (error) {
    console.error(JSON.stringify({ error: error instanceof CheckoutRecoveryError ? error.code : 'RECOVERY_UNAVAILABLE' }))
    process.exitCode = 1
  }
}
