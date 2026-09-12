/**
 * 真实 DeepSeek 端到端验证。
 * 依赖 dist/ 编译产物，运行前若改过 server 代码请先 `npm run build:server`。
 *
 *   node -r dotenv/config scripts/verify-deepseek.js
 */
const { NestFactory } = require('@nestjs/core');
const { Logger } = require('@nestjs/common');

const { AIModule } = require('../dist/server/common/ai/ai.module');
const { AIGatewayService } = require('../dist/server/common/ai/ai-gateway.service');

const TASK_KEY = 'welding_equipment_intelligent_matching';

function mask(v) {
  if (!v) return '(undefined)';
  return `${v.slice(0, 4)}...${v.slice(-4)} (len=${v.length})`;
}

function line(title) {
  process.stdout.write(`\n===== ${title} =====\n`);
}

(async () => {
  line('1. 环境变量');
  console.log('DEEPSEEK_API_KEY   ', mask(process.env.DEEPSEEK_API_KEY));
  console.log('DEEPSEEK_MODEL     ', process.env.DEEPSEEK_MODEL ?? '(默认 deepseek-chat)');
  console.log('DEEPSEEK_BASE_URL  ', process.env.DEEPSEEK_BASE_URL ?? '(默认 https://api.deepseek.com/v1)');
  console.log('AI_DEFAULT_PROVIDER', process.env.AI_DEFAULT_PROVIDER ?? '(未设置 -> apaas-plugin)');
  console.log('AI_FALLBACK_CHAIN  ', process.env.AI_FALLBACK_CHAIN ?? '(空)');

  if (!process.env.DEEPSEEK_API_KEY) {
    console.error('\n[中止] DEEPSEEK_API_KEY 未设置，无法进行真实调用。');
    process.exit(2);
  }

  Logger.overrideLogger(['log', 'warn', 'error']);
  const app = await NestFactory.createApplicationContext(AIModule, { logger: ['log', 'warn', 'error'] });
  const gateway = app.get(AIGatewayService);

  line('2. 适配器注册情况');
  const deepseek = gateway.getAdapter('deepseek');
  console.log('deepseek 适配器:', deepseek ? `已注册 (name=${deepseek.name})` : '未注册');
  if (!deepseek) {
    console.error('[中止] deepseek 适配器未注册，检查 DEEPSEEK_API_KEY 是否被正确读取。');
    await app.close();
    process.exit(3);
  }

  line('3. isAvailable() 连通性探测');
  const available = await deepseek.isAvailable();
  console.log('isAvailable:', available);

  line('4. 裸 chat 调用（验证鉴权与连通）');
  const t0 = Date.now();
  const chat = await deepseek.chat({
    messages: [
      { role: 'system', content: '你是一个只回复最简短答案的助手。' },
      { role: 'user', content: '用一个词回答：中国的首都是哪里？' },
    ],
    temperature: 0,
    maxTokens: 32,
  });
  console.log('耗时(ms):', Date.now() - t0);
  console.log('finishReason:', chat.finishReason);
  console.log('usage:', JSON.stringify(chat.usage));
  console.log('content:', JSON.stringify(chat.content));

  line(`5. 经网关的任务调用 textToJson(${TASK_KEY})`);
  const t1 = Date.now();
  try {
    const bound = gateway.bindTask(TASK_KEY);
    const result = await bound({
      deviceList: JSON.stringify(['焊接机器人 KR16', '气动夹具总成', '输送辊床']),
      modelList: JSON.stringify([
        { model_id: 'M001', model_name: '焊接机器人测算模型', applicable_type: '焊装' },
        { model_id: 'M002', model_name: '夹具测算模型', applicable_type: '焊装' },
        { model_id: 'M003', model_name: '输送设备测算模型', applicable_type: '焊装' },
      ]),
    });
    console.log('耗时(ms):', Date.now() - t1);
    console.log('返回类型:', Array.isArray(result) ? 'array' : typeof result);
    console.log('结果:', JSON.stringify(result, null, 2).slice(0, 1500));
  } catch (err) {
    console.error('任务调用失败:', err && err.message ? err.message : err);
    await app.close();
    process.exit(4);
  }

  line('结论');
  console.log('DeepSeek 真实调用链路验证通过。');
  await app.close();
})().catch((err) => {
  console.error('\n[未捕获异常]', err && err.stack ? err.stack : err);
  process.exit(1);
});
