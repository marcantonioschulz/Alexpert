import { useCallback, useRef, useState } from 'react';
import type { UserPreferences } from '../types/preferences';

type SimulationStatus = 'idle' | 'starting' | 'live' | 'ended' | 'error';

type ScoreResponse = {
  score: number;
  feedback: string;
};

type ConversationPayload = {
  id: string;
  transcript: string | null;
  score: number | null;
  feedback: string | null;
  createdAt: string;
};

const API_HEADERS = import.meta.env.VITE_API_KEY
  ? { 'x-api-key': import.meta.env.VITE_API_KEY as string }
  : undefined;

type SimulationOptions = {
  userId: string;
  preferences: Pick<UserPreferences, 'realtimeModel' | 'responsesModel' | 'apiKeyOverride'>;
};

export const useSimulation = (options: SimulationOptions | null) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<SimulationStatus>('idle');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [score, setScore] = useState<ScoreResponse | null>(null);
  const [transcriptDraft, setTranscriptDraft] = useState('');

  const cleanupMedia = useCallback(() => {
    peerConnectionRef.current?.getSenders().forEach((sender) => sender.track?.stop());
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;

    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
  }, []);

  const startSimulation = useCallback(async () => {
    if (!options) {
      setError('Einstellungen wurden noch nicht geladen.');
      return;
    }

    try {
      setError(null);
      setStatus('starting');

      const startResponse = await fetch('/api/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(API_HEADERS ?? {})
        },
        body: JSON.stringify({ userId: options.userId })
      });

      if (!startResponse.ok) {
        throw new Error('Konnte die Simulation nicht starten.');
      }

      const startPayload: { conversationId: string } = await startResponse.json();
      setConversationId(startPayload.conversationId);

      const tokenResponse = await fetch('/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(API_HEADERS ?? {})
        },
        body: JSON.stringify({
          model: options.preferences.realtimeModel,
          userId: options.userId
        })
      });

      if (!tokenResponse.ok) {
        throw new Error('Konnte kein Ephemeral Token erzeugen.');
      }

      const { token } = (await tokenResponse.json()) as { token: string };

      const localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = localStream;

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      peerConnectionRef.current = pc;

      localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

      pc.addEventListener('track', (event) => {
        const [remoteStream] = event.streams;
        if (audioRef.current) {
          audioRef.current.srcObject = remoteStream;
        }
      });

      const offer = await pc.createOffer({ offerToReceiveAudio: true, voiceActivityDetection: true });
      await pc.setLocalDescription(offer);

      const sdpResponse = await fetch('/api/realtime/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(API_HEADERS ?? {})
        },
        body: JSON.stringify({
          token,
          sdp: offer.sdp,
          conversationId: startPayload.conversationId,
          model: options.preferences.realtimeModel,
          userId: options.userId
        })
      });

      if (!sdpResponse.ok) {
        throw new Error('Konnte keine Antwort vom Realtime-Service erhalten.');
      }

      const { sdp: remoteSdp } = (await sdpResponse.json()) as { sdp: string };
      await pc.setRemoteDescription({ type: 'answer', sdp: remoteSdp });

      setStatus('live');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
      setStatus('error');
      cleanupMedia();
    }
  }, [cleanupMedia, options]);

  const endSimulation = useCallback(async () => {
    cleanupMedia();
    setStatus('ended');
  }, [cleanupMedia]);

  const saveTranscript = useCallback(async () => {
    if (!conversationId) {
      return;
    }

    const response = await fetch(`/api/conversation/${conversationId}/transcript`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(API_HEADERS ?? {})
      },
      body: JSON.stringify({ transcript: transcriptDraft })
    });

    if (!response.ok) {
      throw new Error('Transkript konnte nicht gespeichert werden.');
    }

    const payload = (await response.json()) as ConversationPayload;
    setTranscript(payload.transcript);
    setTranscriptDraft('');
  }, [conversationId, transcriptDraft]);

  const fetchTranscript = useCallback(async () => {
    if (!conversationId) {
      return;
    }

    const response = await fetch(`/api/conversation/${conversationId}`, {
      headers: {
        ...(API_HEADERS ?? {})
      }
    });
    if (!response.ok) {
      throw new Error('Transkript konnte nicht geladen werden.');
    }

    const payload = (await response.json()) as ConversationPayload;
    setTranscript(payload.transcript);
    if (payload.score !== null && payload.feedback !== null) {
      setScore({ score: payload.score, feedback: payload.feedback });
    }
  }, [conversationId]);

  const requestScore = useCallback(async () => {
    if (!conversationId) {
      return;
    }

    if (!options) {
      setError('Einstellungen wurden noch nicht geladen.');
      return;
    }

    const response = await fetch('/api/score', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(API_HEADERS ?? {})
      },
      body: JSON.stringify({
        conversationId,
        userId: options.userId
      })
    });

    if (!response.ok) {
      throw new Error('Score konnte nicht berechnet werden.');
    }

    const payload = (await response.json()) as ScoreResponse & { conversationId: string };
    setScore({ score: payload.score, feedback: payload.feedback });
  }, [conversationId, options]);

  return {
    audioRef,
    conversationId,
    endSimulation,
    error,
    fetchTranscript,
    requestScore,
    saveTranscript,
    score,
    startSimulation,
    status,
    transcript,
    transcriptDraft,
    setTranscriptDraft
  };
};
