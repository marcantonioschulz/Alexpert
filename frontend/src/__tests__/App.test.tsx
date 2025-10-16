import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import App from '../App';

const setTranscriptDraftSpy = vi.hoisted(() => vi.fn());

vi.mock('../hooks/useSimulation', () => ({
  __esModule: true,
  useSimulation: () => ({
    audioRef: { current: null },
    conversationId: 'conversation-123',
    endSimulation: vi.fn(),
    error: null,
    fetchTranscript: vi.fn(),
    requestScore: vi.fn(),
    saveTranscript: vi.fn(),
    score: { score: 88, feedback: 'Strong rapport' },
    startSimulation: vi.fn(),
    status: 'live',
    transcript: 'Hello world',
    transcriptDraft: 'Draft content',
    setTranscriptDraft: setTranscriptDraftSpy
  }),
  setTranscriptDraftSpy
}));

describe('App', () => {
  it('renders simulation controls and updates transcript draft', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByText('KI Verkaufssimulation')).toBeInTheDocument();
    expect(screen.getByText('Simulation läuft')).toBeInTheDocument();
    expect(screen.getByText(/Konversation-ID: conversation-123/)).toBeInTheDocument();
    expect(screen.getByText('88')).toBeInTheDocument();
    expect(screen.getByText('Strong rapport')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('Draft content');

    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), 'Updated note');

    expect(setTranscriptDraftSpy).toHaveBeenCalled();
  });
});
