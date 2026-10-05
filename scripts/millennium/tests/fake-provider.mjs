import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scenario = process.argv[2];
const args = process.argv.slice(3);
const event = data => process.stdout.write(JSON.stringify(data) + '\n');
event({ type: 'thread.started', thread_id: 'fixture-thread' });
if (['hang', 'tree', 'stubborn-tree'].includes(scenario)) {
  if (scenario !== 'hang') {
    const dir = path.dirname(args[args.indexOf('--output-last-message') + 1]);
    const script = fileURLToPath(new URL('./fake-descendant.mjs', import.meta.url));
    const descendant = spawn(process.execPath, [script, scenario, path.join(dir, 'descendant.ready')], { stdio: 'ignore' });
    fs.writeFileSync(path.join(dir, 'descendant.pid'), String(descendant.pid));
  }
  setInterval(() => {}, 1000);
} else if (scenario === 'fail') {
  process.stderr.write('Acesso ao provedor indisponivel.\n');
  event({ type: 'turn.failed', error: { message: 'not authenticated' } });
  process.exitCode = 2;
} else {
  if (scenario === 'mutate') fs.writeFileSync(path.join(process.cwd(), 'unexpected.txt'), 'not read-only');
  const response = 'Revisao e acao: tarefa ficticia, sem aceite humano.';
  if (scenario !== 'empty') {
    const message = JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: response } }) + '\n';
    if (scenario === 'unicode') {
      const unicode = Buffer.from(message.replace('acao', 'a\u00e7\u00e3o'));
      const offset = unicode.indexOf(Buffer.from('\u00e7')) + 1;
      process.stdout.write(unicode.subarray(0, offset));
      await new Promise(resolve => setTimeout(resolve, 10));
      process.stdout.write(unicode.subarray(offset));
    } else {
      event({ type: 'item.completed', item: { type: 'agent_message', text: response } });
      const outputIndex = args.indexOf('--output-last-message');
      if (scenario !== 'fallback' && outputIndex >= 0) fs.writeFileSync(args[outputIndex + 1], response);
    }
  }
  event({ type: 'turn.completed', usage: { input_tokens: 10, output_tokens: 5, cached_input_tokens: 0 } });
}
process.stdin.resume();
