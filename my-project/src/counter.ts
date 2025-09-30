import { RealtimeAgent, RealtimeSession } from '@openai/agents/realtime';

export async function setupCounter(element: HTMLButtonElement) {
  let counter = 0
  const setCounter = (count: number) => {
    counter = count
    element.innerHTML = `count is ${counter} (Voice Agent Ready!)`
  }
  element.addEventListener('click', () => setCounter(counter + 1))
  setCounter(0)
  
  // OpenAI Voice Agent setup
  const agent = new RealtimeAgent({
    name: 'Assistant',
    instructions: 'You are a helpful assistant.',
  });
  const session = new RealtimeSession(agent, {
    model: 'gpt-realtime',
  });
  
  // Connect to voice agent
  try {
    await session.connect({
      apiKey: 'ek_68d6c717361881919f2c325e3f9f4b18',
    });
    console.log('🎉 Voice Agent connected! You can now speak.');
    element.style.backgroundColor = '#22c55e';
    element.style.color = 'white';
  } catch (e) {
    console.error('❌ Voice Agent failed:', e);
    element.style.backgroundColor = '#ef4444';
    element.style.color = 'white';
  }
}
