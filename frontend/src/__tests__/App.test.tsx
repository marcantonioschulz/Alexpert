import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import App from '../App';

const setTranscriptDraftSpy = vi.hoisted(() => vi.fn());

// Mock Clerk authentication
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
    getToken: vi.fn().mockResolvedValue('mock-token')
  }),
  useUser: () => ({
    isLoaded: true,
    user: { id: 'user-123', emailAddresses: [{ emailAddress: 'test@example.com' }] }
  }),
  useOrganization: () => ({
    isLoaded: true,
    organization: { id: 'org-123', name: 'Test Org' }
  }),
  UserButton: () => <div data-testid="user-button">User Menu</div>,
  OrganizationSwitcher: () => <div data-testid="org-switcher">Org Switcher</div>
}));

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

vi.mock('../features/analytics/useAnalyticsData', () => ({
  __esModule: true,
  useAnalyticsData: () => ({
    summary: null,
    trend: [],
    distribution: [],
    loading: false,
    error: null,
    refresh: vi.fn()
  })
}));

vi.mock('../features/settings/useSettingsManager', () => ({
  __esModule: true,
  useSettingsManager: () => ({
    settings: null,
    isLoading: false,
    error: null,
    updateSettings: vi.fn()
  })
}));

describe('App', () => {
  it('renders simulation controls and updates transcript draft', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByText('KI Verkaufssimulation')).toBeInTheDocument();
    expect(screen.getByText('Simulation läuft')).toBeInTheDocument();
    expect(screen.getByText(/Konversation-ID: conversation-123/)).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('Draft content');
    expect(screen.getByText('Hello world')).toBeInTheDocument();

    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), 'Updated note');

    expect(setTranscriptDraftSpy).toHaveBeenCalled();
  });
});
