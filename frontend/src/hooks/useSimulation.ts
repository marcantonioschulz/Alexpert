import { useCallback, useRef, useState } from 'react';
import type { UserPreferences } from '../types/preferences';

type SimulationStatus = 'idle' | 'starting' | 'live' | 'ended' | 'error';
type SpeakerState = 'idle' | 'ai' | 'user';
type ScorePhase = 'idle' | 'loading' | 'ready' | 'error';
type TranscriptPhase = 'idle' | 'loading' | 'saving';

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
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const teardownRemoteTrackListenersRef = useRef<(() => void) | null>(null);
  const aiSpeakingRef = useRef(false);
  const userSpeakingRef = useRef(false);
  const idleTimeoutRef = useRef<number | null>(null);

  const [status, setStatus] = useState<SimulationStatus>('idle');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [score, setScore] = useState<ScoreResponse | null>(null);
  const [transcriptDraft, setTranscriptDraft] = useState('');
  const [conversationDetails, setConversationDetails] = useState<ConversationPayload | null>(null);
  const [speakerState, setSpeakerState] = useState<SpeakerState>('idle');
  const [scorePhase, setScorePhase] = useState<ScorePhase>('idle');
  const [transcriptPhase, setTranscriptPhase] = useState<TranscriptPhase>('idle');

  const updateSpeakerState = useCallback((next: SpeakerState) => {
    setSpeakerState((current) => (current === next ? current : next));

    if (next === 'ai') {
      aiSpeakingRef.current = true;
      userSpeakingRef.current = false;
    } else if (next === 'user') {
      userSpeakingRef.current = true;
      aiSpeakingRef.current = false;
    } else {
      aiSpeakingRef.current = false;
      userSpeakingRef.current = false;
    }
  }, []);

  const setIdleWithDelay = useCallback(() => {
    if (idleTimeoutRef.current) {
      window.clearTimeout(idleTimeoutRef.current);
    }

    idleTimeoutRef.current = window.setTimeout(() => {
      if (!aiSpeakingRef.current && !userSpeakingRef.current) {
        updateSpeakerState('idle');
      }
    }, 250);
  }, [updateSpeakerState]);

  const attachRemoteTrackListeners = useCallback(
    (track: MediaStreamTrack) => {
      const handleUnmute = () => {
        aiSpeakingRef.current = true;
        updateSpeakerState('ai');
      };

      const handleMute = () => {
        aiSpeakingRef.current = false;
        if (userSpeakingRef.current) {
          updateSpeakerState('user');
        } else {
          setIdleWithDelay();
        }
      };

      const handleEnded = () => {
        aiSpeakingRef.current = false;
        setIdleWithDelay();
      };

      track.addEventListener('unmute', handleUnmute);
      track.addEventListener('mute', handleMute);
      track.addEventListener('ended', handleEnded);

      return () => {
        track.removeEventListener('unmute', handleUnmute);
        track.removeEventListener('mute', handleMute);
        track.removeEventListener('ended', handleEnded);
      };
    },
    [setIdleWithDelay, updateSpeakerState]
  );

  const handleVadMessage = useCallback(
    (rawMessage: string) => {
      try {
        const payload = JSON.parse(rawMessage);
        if (!payload || typeof payload !== 'object') {
          return;
        }

        if ('type' in payload && payload.type === 'server_vad') {
          const status =
            (typeof payload.status === 'string' && payload.status) ||
            (typeof payload.event === 'string' && payload.event) ||
            (payload.data && typeof payload.data.status === 'string' && payload.data.status);

          if (!status) {
            return;
          }

          const normalized = status.toLowerCase();
          if (normalized.includes('start')) {
            userSpeakingRef.current = true;
            updateSpeakerState('user');
            if (idleTimeoutRef.current) {
              window.clearTimeout(idleTimeoutRef.current);
              idleTimeoutRef.current = null;
            }
          }

          if (normalized.includes('stop') || normalized.includes('end')) {
            userSpeakingRef.current = false;
            if (aiSpeakingRef.current) {
              updateSpeakerState('ai');
            } else {
              setIdleWithDelay();
            }
          }
        }
      } catch (parseError) {
        console.warn('Unable to parse VAD message', parseError);
      }
    },
    [setIdleWithDelay, updateSpeakerState]
  );

  const cleanupMedia = useCallback(() => {
    if (idleTimeoutRef.current) {
      window.clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = null;
    }

    teardownRemoteTrackListenersRef.current?.();
    teardownRemoteTrackListenersRef.current = null;

    dataChannelRef.current?.close();
    dataChannelRef.current = null;

    peerConnectionRef.current?.getSenders().forEach((sender) => sender.track?.stop());
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;

    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;

    aiSpeakingRef.current = false;
    userSpeakingRef.current = false;
    updateSpeakerState('idle');
  }, [updateSpeakerState]);

  const startSimulation = useCallback(async () => {
    if (!options) {
      setError('Einstellungen wurden noch nicht geladen.');
      return;
    }

    try {
      setError(null);
      setStatus('starting');
      setTranscript(null);
      setTranscriptDraft('');
      setScore(null);
      setScorePhase('idle');
      setTranscriptPhase('idle');
      updateSpeakerState('idle');

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
      setConversationDetails((previous) =>
        previous?.id === startPayload.conversationId ? previous : null
      );

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

        teardownRemoteTrackListenersRef.current?.();
        const remoteTrack = event.track;
        teardownRemoteTrackListenersRef.current = attachRemoteTrackListeners(remoteTrack);
      });

      pc.addEventListener('datachannel', (event) => {
        const channel = event.channel;
        dataChannelRef.current = channel;
        channel.onmessage = (messageEvent) => {
          if (typeof messageEvent.data === 'string') {
            handleVadMessage(messageEvent.data);
          }
        };
      });

      const offer = await pc.createOffer({ offerToReceiveAudio: true });
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
  }, [attachRemoteTrackListeners, cleanupMedia, handleVadMessage, options, updateSpeakerState]);

  const endSimulation = useCallback(async () => {
    cleanupMedia();
    setStatus('ended');
  }, [cleanupMedia]);

  const saveTranscript = useCallback(async () => {
    if (!conversationId) {
      return;
    }

    try {
      setTranscriptPhase('saving');
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
      setConversationDetails(payload);
      setTranscriptPhase('idle');
    } catch (err) {
      console.error(err);
      setTranscriptPhase('idle');
      setError(
        err instanceof Error
          ? err.message
          : 'Unbekannter Fehler beim Speichern des Transkripts'
      );
    }
  }, [conversationId, transcriptDraft]);

  const fetchTranscript = useCallback(async () => {
    if (!conversationId) {
      return;
    }

    try {
      setTranscriptPhase('loading');
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
      setConversationDetails(payload);
      if (payload.score !== null && payload.feedback !== null) {
        setScore({ score: payload.score, feedback: payload.feedback });
        setScorePhase('ready');
      }
      setTranscriptPhase('idle');
    } catch (err) {
      console.error(err);
      setTranscriptPhase('idle');
      setError(
        err instanceof Error
          ? err.message
          : 'Unbekannter Fehler beim Laden des Transkripts'
      );
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

    try {
      setScorePhase('loading');
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
      setConversationDetails((previous) => {
        if (!previous || previous.id !== payload.conversationId) {
          return previous;
        }

        return {
          ...previous,
          score: payload.score,
          feedback: payload.feedback
        };
      });
      setScorePhase('ready');
    } catch (err) {
      console.error(err);
      setScorePhase('error');
      setError(
        err instanceof Error
          ? err.message
          : 'Unbekannter Fehler bei der Score-Berechnung'
      );
    }
  }, [conversationId, options]);

  return {
    audioRef,
    conversationId,
    conversationDetails,
    endSimulation,
    error,
    fetchTranscript,
    scorePhase,
    speakerState,
    requestScore,
    saveTranscript,
    score,
    startSimulation,
    status,
    transcript,
    transcriptPhase,
    transcriptDraft,
    setTranscriptDraft
  };
};
